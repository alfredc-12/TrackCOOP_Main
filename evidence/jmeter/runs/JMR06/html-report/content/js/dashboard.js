/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.5540281329923273, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.038461538461538464, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.3870967741935484, 500, 1500, "TX_J09"], "isController": true}, {"data": [0.9420289855072463, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [0.696969696969697, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.04285714285714286, 500, 1500, "TX_J03"], "isController": true}, {"data": [0.9424460431654677, 500, 1500, "TX_J02"], "isController": true}, {"data": [0.7258064516129032, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.6901408450704225, 500, 1500, "TX_J01"], "isController": true}, {"data": [0.7258064516129032, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.3155339805825243, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.5967741935483871, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.43548387096774194, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [0.7741935483870968, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [0.7419354838709677, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.6834532374100719, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.03365384615384615, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [0.696969696969697, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [0.734375, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [0.8709677419354839, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.1774193548387097, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.6, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.6336633663366337, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.616504854368932, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 904, 0, 0.0, 1721.752212389381, 42, 44770, 551.0, 3954.0, 6448.75, 19846.900000000016, 2.497761961074701, 17.48505146280711, 0.7010870635133344], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 13, 0, 0.0, 6656.615384615384, 1339, 43124, 3258.0, 29182.79999999999, 43124.0, 43124.0, 0.03859215807347947, 2.295659393405491, 0.011042482730009262], "isController": false}, {"data": ["TX_J09", 31, 0, 0.0, 1730.4838709677417, 385, 9257, 880.0, 6731.600000000004, 9249.8, 9257.0, 0.09438414346389806, 2.6758755033186685, 0.05115546838131194], "isController": true}, {"data": ["J02 01 /api/auth/me", 138, 0, 0.0, 256.29710144927526, 42, 3145, 114.0, 466.4000000000014, 1035.8999999999994, 3057.249999999997, 0.3880055670363966, 0.5140705834493132, 0.10424464559346576], "isController": false}, {"data": ["TX_J04", 33, 0, 0.0, 870.9999999999999, 187, 3555, 404.0, 2570.2000000000003, 3019.4999999999977, 3555.0, 0.09321559920681999, 0.9459678559776622, 0.026489979852719354], "isController": true}, {"data": ["TX_J03", 105, 0, 0.0, 5437.828571428573, 0, 32906, 3135.0, 15612.60000000001, 21530.999999999996, 32568.499999999985, 0.30374561738466344, 0.8699464322907626, 0.08466005079783848], "isController": true}, {"data": ["TX_J02", 139, 0, 0.0, 254.45323741007186, 0, 3145, 112.0, 450.0, 1034.0, 3054.9999999999986, 0.3894975761481772, 0.5123347831493261, 0.10389265523860229], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 31, 0, 0.0, 1264.9032258064517, 179, 9343, 313.0, 5627.600000000002, 8055.399999999997, 9343.0, 0.09479687476109659, 0.6835444761708179, 0.026291320734522883], "isController": false}, {"data": ["TX_J01", 142, 0, 0.0, 993.9577464788729, 0, 10754, 456.5, 2592.2000000000025, 3774.95, 9924.099999999988, 0.3944411574347992, 4.203336825491732, 0.10637389653697331], "isController": true}, {"data": ["TX_J08", 31, 0, 0.0, 1264.9032258064517, 179, 9343, 313.0, 5627.600000000002, 8055.399999999997, 9343.0, 0.0947960051128684, 0.6835382054657543, 0.026291079543022098], "isController": true}, {"data": ["TX_J07", 13, 0, 0.0, 17981.076923076926, 4102, 61859, 11152.0, 56253.799999999996, 61859.0, 61859.0, 0.03780586398031768, 4.084564061127719, 0.021745755746491322], "isController": true}, {"data": ["TX_J06", 32, 0, 0.0, 3406.78125, 2085, 15533, 2450.0, 6239.199999999999, 11268.349999999986, 15533.0, 0.09552352863914793, 1.258264790848249, 0.05391855425139405], "isController": true}, {"data": ["TX_J05", 103, 0, 0.0, 2216.233009708738, 527, 14054, 1195.0, 5453.000000000001, 9989.599999999999, 14011.479999999994, 0.3045751324753974, 0.8209251617500947, 0.17857750106453446], "isController": true}, {"data": ["J10 01 /api/documents", 31, 0, 0.0, 1386.161290322581, 268, 8037, 648.0, 5097.8, 6547.199999999996, 8037.0, 0.09457707268705667, 1.0884020335977425, 0.025583837045229197], "isController": false}, {"data": ["J10 02 /api/announcements", 31, 0, 0.0, 1721.6129032258063, 289, 11485, 889.0, 4015.8, 10167.399999999998, 11485.0, 0.09448569303731881, 1.1640128997735393, 0.025928202874498617], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 32, 0, 0.0, 2577.4375000000005, 1860, 11377, 2061.5, 3924.2, 6672.949999999984, 11377.0, 0.09558944334085105, 0.12478144649978344, 0.027351276268427108], "isController": false}, {"data": ["J09 01 /api/inventory", 31, 0, 0.0, 774.0645161290322, 136, 3805, 451.0, 2197.600000000001, 3468.399999999999, 3805.0, 0.0947852807631744, 0.7329824828774977, 0.025640158956444635], "isController": false}, {"data": ["J09 02 /api/pos/orders", 31, 0, 0.0, 956.4193548387098, 176, 6852, 370.0, 3585.800000000002, 6348.5999999999985, 6852.0, 0.09471432936144211, 1.9528027612282308, 0.025713460510235257], "isController": false}, {"data": ["J01 01 /api/public/landing", 139, 0, 0.0, 1015.4100719424457, 169, 10754, 474.0, 2633.0, 3785.0, 9981.999999999989, 0.38866224691516815, 4.231144616433703, 0.10707762864300953], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 13, 0, 0.0, 11324.461538461537, 2097, 44770, 9047.0, 34807.19999999999, 44770.0, 44770.0, 0.03803727653100038, 1.8469137916215586, 0.010995150247242298], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 104, 0, 0.0, 5490.115384615386, 1008, 32906, 3140.5, 15778.5, 21549.5, 32624.750000000015, 0.30197006431381657, 0.8731771097980576, 0.08497444868686577], "isController": false}, {"data": ["J04 01 /api/membership-applications", 33, 0, 0.0, 870.9999999999999, 187, 3555, 404.0, 2570.2000000000003, 3019.4999999999977, 3555.0, 0.09321401938851602, 0.9459518237111043, 0.026489530900447426], "isController": false}, {"data": ["J06 01 /api/financial-records", 32, 0, 0.0, 829.3437499999999, 177, 4908, 421.5, 2261.7999999999997, 4419.199999999998, 4908.0, 0.0961555797279999, 1.1410698838846254, 0.0267620509985156], "isController": false}, {"data": ["J10 03 /api/activities", 31, 0, 0.0, 388.516129032258, 102, 1524, 195.0, 1328.6000000000001, 1512.6, 1524.0, 0.09462701692907859, 0.109758277574618, 0.025689756549105318], "isController": false}, {"data": ["TX_J10", 31, 0, 0.0, 3496.2903225806454, 763, 17521, 1752.0, 11993.000000000004, 16604.8, 17521.0, 0.09425042032647128, 2.355078815013788, 0.07694663221965821], "isController": true}, {"data": ["SETUP login", 10, 0, 0.0, 795.3000000000001, 470, 1589, 728.0, 1535.7000000000003, 1589.0, 1589.0, 0.18784987038358944, 0.2990004919318481, 0.05798764065259045], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 101, 0, 0.0, 1086.8712871287125, 210, 6567, 590.0, 3024.7999999999984, 4822.099999999999, 6553.120000000003, 0.3013306283191121, 0.3589110468628796, 0.08979841521719673], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 103, 0, 0.0, 1150.466019417476, 231, 8181, 631.0, 2588.8000000000006, 5385.999999999997, 8161.079999999997, 0.30457333120427704, 0.4651910615489476, 0.08957410649864864], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 904, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
