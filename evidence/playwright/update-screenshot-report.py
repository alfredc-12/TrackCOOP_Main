from pathlib import Path
import json
from docx import Document
from docx.shared import Inches, Pt
from docx.oxml import OxmlElement

root=Path(__file__).resolve().parents[2]
path=root/'TrackCOOP_Playwright_Testing_and_Screenshot_Evidence.docx'
image_root=root/'evidence/playwright/final-screenshots'
manifest=json.loads((image_root/'manifest.json').read_text(encoding='utf8'))
doc=Document(path)
for section in doc.sections:
 section.top_margin=Inches(.6);section.bottom_margin=Inches(.5)
headings={p.text:p for p in doc.paragraphs if p.style.name.startswith('Heading')}
start=headings['10 Demonstration Screenshot Inventory']._p
end=headings['12 Appendix Ready Detailed Test Cases']._p
body=start.getparent();children=list(body);a=children.index(start);b=children.index(end)
assert a<b
for element in children[a:b]:body.remove(element)
def move(element):end.addprevious(element)
def paragraph(text='',style=None):
 p=doc.add_paragraph(text,style=style);move(p._p);return p
def heading(text,level=1):
 p=doc.add_heading(text,level);move(p._p);return p
heading('10 Demonstration Screenshot Inventory')
paragraph('The following 50 subjects are mapped to the verified synthetic screenshots. Ready means the named subject is visible; partial identifies a narrower view, and unavailable identifies a missing capture. Full paths, roles, routes, capture dates and supplementary images are recorded in final-screenshots/manifest.json and README.md. The original test evidence remains in its historical run folders.')
t=doc.add_table(rows=1,cols=4);t.style='Light Shading Accent 1'
for c,v in zip(t.rows[0].cells,['ID','Screenshot subject','Image file','Coverage and limitation']):c.text=v
t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
for row in manifest['inventory']:
 cells=t.add_row().cells
 for c,v in zip(cells,[row['id'],row['subject'],row['file'] or 'Unavailable',row['verification'].capitalize()+': '+row['description']]): c.text=v
 t.rows[-1]._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
move(t._tbl)
heading('11 Representative System Screenshots')
paragraph('The following 25 figures are genuine application captures from the isolated test environment. All member and transaction records shown are synthetic. Related screenshots are grouped by module; additional images are retained in the screenshot collection.')
current_module=None
for i,figure in enumerate(manifest['figures'],1):
 file=figure['file'];meta=next(x for x in manifest['images'] if x['file']==file)
 if meta['module']!=current_module:
  current_module=meta['module'];heading(current_module.replace('-',' ').title(),2)
 p=doc.add_paragraph();p.paragraph_format.keep_with_next=True
 run=p.add_run();run.add_picture(str(image_root/file),width=Inches(6.0));move(p._p)
 caption=paragraph(f"Figure {i}. {figure['caption']}",style='Caption');caption.paragraph_format.keep_with_next=True
 description=meta['description'];role=meta['role'] or 'public'
 p=paragraph(f"{description} Role: {role}. Source: {file}.");p.paragraph_format.space_after=Pt(8)
for p in doc.paragraphs:
 if p.text.startswith('Review the remaining duplicate-category response'):
  p.paragraph_format.space_before=Pt(0);p.paragraph_format.space_after=Pt(0);p.paragraph_format.line_spacing=1.0
  for run in p.runs: run.font.size=Pt(9)
doc.save(path)
check=Document(path)
assert len(check.inline_shapes)==25 and len(check.tables)==6
print(f'Updated {path}; 50 inventory subjects; {len(check.inline_shapes)} figures; {len(check.tables)} tables.')
