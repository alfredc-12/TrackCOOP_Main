"""Generate the TrackCOOP JMeter plan. Credentials are read only at runtime."""
import xml.etree.ElementTree as E
from pathlib import Path

root=E.Element('jmeterTestPlan',version='1.2',properties='5.0',jmeter='5.6.3')
tree=E.SubElement(root,'hashTree')
def prop(parent,kind,name,value):
    E.SubElement(parent,kind+'Prop',name=name).text=str(value)
def element(parent,tag,name,gui,clazz=None):
    node=E.SubElement(parent,tag,guiclass=gui,testclass=clazz or tag,testname=name,enabled='true')
    return node,E.SubElement(parent,'hashTree')
plan,p=element(tree,'TestPlan','TrackCOOP development performance','TestPlanGui')
prop(plan,'string','TestPlan.comments','Loopback-only test API. Synthetic per-user identities. No financial writes.')
prop(plan,'bool','TestPlan.functional_mode','false');prop(plan,'bool','TestPlan.serialize_threadgroups','false')
args=E.SubElement(plan,'elementProp',name='TestPlan.user_defined_variables',elementType='Arguments',guiclass='ArgumentsPanel',testclass='Arguments',testname='Variables',enabled='true'); E.SubElement(args,'collectionProp',name='Arguments.arguments')
threads,t=element(p,'ThreadGroup','Total virtual users','ThreadGroupGui')
prop(threads,'string','ThreadGroup.on_sample_error','continue')
loop=E.SubElement(threads,'elementProp',name='ThreadGroup.main_controller',elementType='LoopController',guiclass='LoopControlPanel',testclass='LoopController',testname='Loop Controller',enabled='true')
prop(loop,'bool','LoopController.continue_forever','false');prop(loop,'string','LoopController.loops','-1')
prop(threads,'string','ThreadGroup.num_threads','${__P(users,1)}');prop(threads,'string','ThreadGroup.ramp_time','${__P(ramp,1)}')
prop(threads,'bool','ThreadGroup.scheduler','true');prop(threads,'string','ThreadGroup.duration','${__P(duration,30)}');prop(threads,'string','ThreadGroup.delay','0')
cookie,c=element(t,'CookieManager','Per-user cookies','CookiePanel');prop(cookie,'bool','CookieManager.clearEachIteration','false');prop(cookie,'bool','CookieManager.controlledByThreadGroup','false');E.SubElement(cookie,'collectionProp',name='CookieManager.cookies')
headers,h=element(t,'HeaderManager','JSON and synthetic client','HeaderPanel');collection=E.SubElement(headers,'collectionProp',name='HeaderManager.headers')
for name,value in [('Content-Type','application/json'),('Accept','application/json'),('X-JMeter-Slot','${slot}')]:
    x=E.SubElement(collection,'elementProp',name='',elementType='Header');prop(x,'string','Header.name',name);prop(x,'string','Header.value',value)
once,o=element(t,'OnceOnlyController','Authenticate once','OnceOnlyControllerGui')

def sampler(parent,label,path,method='GET',body=None,shape='success'):
    s,st=element(parent,'HTTPSamplerProxy',label,'HttpTestSampleGui');prop(s,'string','HTTPSampler.domain','127.0.0.1');prop(s,'string','HTTPSampler.port','3218');prop(s,'string','HTTPSampler.protocol','http');prop(s,'string','HTTPSampler.path',path);prop(s,'string','HTTPSampler.method',method)
    for n,v in [('HTTPSampler.follow_redirects','false'),('HTTPSampler.auto_redirects','false'),('HTTPSampler.use_keepalive','true'),('HTTPSampler.DO_MULTIPART_POST','false')]:prop(s,'bool',n,v)
    prop(s,'string','HTTPSampler.connect_timeout','30000');prop(s,'string','HTTPSampler.response_timeout','60000')
    a=E.SubElement(s,'elementProp',name='HTTPsampler.Arguments',elementType='Arguments');coll=E.SubElement(a,'collectionProp',name='Arguments.arguments')
    if body is not None:
        prop(s,'bool','HTTPSampler.postBodyRaw','true');arg=E.SubElement(coll,'elementProp',name='',elementType='HTTPArgument');prop(arg,'bool','HTTPArgument.always_encode','false');prop(arg,'string','Argument.value',body);prop(arg,'string','Argument.metadata','=')
    assertion,ast=element(st,'JSR223Assertion','Validate status and response','TestBeanGUI');prop(assertion,'string','scriptLanguage','groovy');prop(assertion,'string','cacheKey','true')
    script="""import groovy.json.JsonSlurper
try {
 if (prev.getResponseCode() != '200') throw new Exception('Expected HTTP 200; received '+prev.getResponseCode())
 def value = new JsonSlurper().parseText(prev.getResponseDataAsString())
 def shape = 'SHAPE'
 if (shape == 'success' && (!(value instanceof Map) || value.success != true || !value.containsKey('data'))) throw new Exception('Expected success/data envelope')
 if (shape == 'array' && !(value instanceof List)) throw new Exception('Expected array')
 if (shape == 'documents' && (!(value instanceof Map) || !(value.documents instanceof List))) throw new Exception('Expected documents list')
 if (shape == 'dashboard' && (!(value instanceof Map) || value.isLinked != true || value.membershipType != 'True Member')) throw new Exception('Expected linked true-member dashboard')
 if (shape == 'identity' && (!(value instanceof Map) || value.success != true || value.data.email != vars.get('identifier'))) throw new Exception('Authenticated identity mismatch')
 if (shape == 'capital') {
   def expected = vars.get('identifier').replaceFirst('-[0-9]{2}@example[.]test$', '') + '-' + vars.get('slot')
   if (!(value instanceof Map) || value.success != true || value.data.member.memberCode != expected || value.data.reconciliation.reconciled != true) throw new Exception('Share-capital owner or reconciliation mismatch')
   vars.put('ownerMemberId',value.data.member.memberId.toString())
 }
 if (shape == 'capitalTransactions') {
   if (!(value instanceof Map) || value.success != true || !(value.data instanceof List) || !vars.get('ownerMemberId')) throw new Exception('Missing owner or transaction list')
   if (value.data.any { it.memberId.toString() != vars.get('ownerMemberId') }) throw new Exception('Cross-member transaction returned')
 }
} catch (Exception ex) { AssertionResult.setFailure(true); AssertionResult.setFailureMessage(ex.message) }
""".replace('SHAPE',shape)
    prop(assertion,'string','script',script)
    return s,st

login,lt=sampler(o,'SETUP login','/api/auth/login','POST','{"identifier":"${identifier}","password":"${password}"}','identity')
pre,pt=element(lt,'JSR223PreProcessor','Load one CSV row per thread','TestBeanGUI');prop(pre,'string','scriptLanguage','groovy');prop(pre,'string','cacheKey','true');prop(pre,'string','script',"""def f = new File(props.get('credentials', 'scratch/jmeter-private/users.csv'))
def rows = f.readLines('UTF-8'); def i = ctx.getThreadNum()+1
if (i >= rows.size()) throw new IllegalStateException('Not enough synthetic identities')
def parts = rows[i].split(',', -1)
if (parts.length != 4) throw new IllegalStateException('Invalid credential CSV')
vars.put('identifier',parts[0]); vars.put('password',parts[1]); vars.put('role',parts[2]); vars.put('slot',parts[3])
""")
timer,tt=element(t,'ConstantTimer','Think time per request','ConstantTimerGui');prop(timer,'string','ConstantTimer.delay','2000')
groups=[
 ('J01','all',[('/api/public/landing','success')]),
 ('J02','all',[('/api/auth/me','identity')]),
 ('J03','member',[('/api/members/me/dashboard','dashboard')]),
 ('J04','staff',[('/api/membership-applications','success')]),
 ('J05','member',[('/api/members/me/share-capital/overview','capital'),('/api/members/me/share-capital/transactions','capitalTransactions')]),
 ('J06','staff',[('/api/financial-records','success'),('/api/financial-records/summary','success')]),
 ('J07','chairman',[('/api/chairman/member-analytics','success'),('/api/chairman/financial-analytics','success')]),
 ('J08','staff',[('/api/rental/schedules','array')]),
 ('J09','staff',[('/api/inventory','array'),('/api/pos/orders','array')]),
 ('J10','staff',[('/api/documents','documents'),('/api/announcements','success'),('/api/activities','success')])]
for group,role,requests in groups:
    container=t
    if role!='all':
        ctrl,container=element(t,'IfController',f'{group} role: {role}','IfControllerPanel')
        condition={'member':"vars.get('role') == 'member'",'staff':"vars.get('role') == 'chairman' || vars.get('role') == 'bookkeeper'",'chairman':"vars.get('role') == 'chairman'"}[role]
        prop(ctrl,'string','IfController.condition','${__groovy('+condition+')}');prop(ctrl,'bool','IfController.evaluateAll','false');prop(ctrl,'bool','IfController.useExpression','true')
    tx,tx_tree=element(container,'TransactionController','TX_'+group,'TransactionControllerGui');prop(tx,'bool','TransactionController.includeTimers','false');prop(tx,'bool','TransactionController.parent','false')
    for idx,(path,shape) in enumerate(requests,1): sampler(tx_tree,f'{group} {idx:02} {path}',path,shape=shape)
E.indent(root,space='  ')
E.ElementTree(root).write(Path('evidence/jmeter/trackcoop-performance.jmx'),encoding='utf-8',xml_declaration=True)
