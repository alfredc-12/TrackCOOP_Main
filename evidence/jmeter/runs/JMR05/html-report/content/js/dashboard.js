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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.6402476780185758, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.10714285714285714, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.671875, 500, 1500, "TX_J09"], "isController": true}, {"data": [0.9300699300699301, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [0.8571428571428571, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.1712962962962963, 500, 1500, "TX_J03"], "isController": true}, {"data": [0.9305555555555556, 500, 1500, "TX_J02"], "isController": true}, {"data": [0.8125, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.7758620689655172, 500, 1500, "TX_J01"], "isController": true}, {"data": [0.8125, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.4375, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.71875, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.59375, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [0.828125, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [0.8125, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.7758620689655172, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.1712962962962963, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [0.8529411764705882, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [0.8235294117647058, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [0.828125, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.359375, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.7, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.7524271844660194, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.7740384615384616, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 935, 0, 0.0, 1668.4802139037442, 37, 51438, 356.0, 3466.599999999998, 7362.599999999999, 23142.67999999995, 2.432710195267273, 17.23464290708868, 0.6826549063991986], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 14, 0, 0.0, 4120.571428571428, 1054, 20831, 1939.5, 14795.5, 20831.0, 20831.0, 0.04095507228570259, 2.4362268731826187, 0.011718590019248883], "isController": false}, {"data": ["TX_J09", 32, 0, 0.0, 1645.5937500000002, 282, 19953, 493.5, 4144.5, 11009.64999999997, 19953.0, 0.09941253405655952, 2.8185006725879256, 0.053880816798232936], "isController": true}, {"data": ["J02 01 /api/auth/me", 143, 0, 0.0, 262.7062937062938, 37, 5317, 75.0, 689.7999999999988, 1235.7999999999963, 4583.080000000004, 0.40186939525681703, 0.5325526944218842, 0.10796782041356015], "isController": false}, {"data": ["TX_J04", 35, 0, 0.0, 945.3428571428572, 0, 13596, 215.0, 1642.3999999999992, 8465.599999999973, 13596.0, 0.09839697274684989, 0.9700447987360206, 0.02716349465282737], "isController": true}, {"data": ["TX_J03", 108, 0, 0.0, 5465.842592592594, 1003, 40926, 1867.0, 17088.400000000012, 29518.149999999994, 40380.77999999998, 0.30127455875830245, 0.8712531591984981, 0.08477705682651886], "isController": true}, {"data": ["TX_J02", 144, 0, 0.0, 260.8819444444445, 0, 5317, 75.0, 670.0, 1225.25, 4566.400000000019, 0.4037605811909255, 0.5313431856289272, 0.1077226089452596], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 32, 0, 0.0, 1589.3437499999998, 139, 19054, 254.0, 5857.699999999997, 14864.099999999986, 19054.0, 0.09947124814657089, 0.7172809534319134, 0.027587728978150518], "isController": false}, {"data": ["TX_J01", 145, 0, 0.0, 993.1379310344827, 157, 10524, 282.0, 3108.000000000001, 4832.599999999998, 10408.079999999998, 0.4025451961089148, 4.38239633420135, 0.11090326196947319], "isController": true}, {"data": ["TX_J08", 32, 0, 0.0, 1589.3437499999998, 139, 19054, 254.0, 5857.699999999997, 14864.099999999986, 19054.0, 0.09947001134579816, 0.7172720349388415, 0.027587385959186212], "isController": true}, {"data": ["TX_J07", 14, 0, 0.0, 12922.857142857143, 3043, 58798, 5584.5, 46000.5, 58798.0, 58798.0, 0.038222125150158354, 4.129557220568964, 0.021985187220159443], "isController": true}, {"data": ["TX_J06", 34, 0, 0.0, 3298.176470588235, 1995, 17886, 2227.5, 5618.5, 14753.25, 17886.0, 0.09712537457543356, 1.2794181422343978, 0.054822721195899024], "isController": true}, {"data": ["TX_J05", 104, 0, 0.0, 2049.971153846154, 408, 16451, 716.0, 6356.0, 11569.75, 16403.050000000003, 0.30671770763904044, 0.8304672247061113, 0.18072831723311136], "isController": true}, {"data": ["J10 01 /api/documents", 32, 0, 0.0, 1730.5, 209, 10515, 416.0, 7464.999999999999, 8869.199999999995, 10515.0, 0.09936345287998759, 1.1433377241499767, 0.026878590281012263], "isController": false}, {"data": ["J10 02 /api/announcements", 32, 0, 0.0, 2005.0937500000002, 258, 11483, 522.0, 8340.3, 11258.099999999999, 11483.0, 0.09866950341488984, 1.2250188618704039, 0.027076299276937544], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 34, 0, 0.0, 2394.6470588235293, 1848, 8597, 1948.0, 3187.0, 6761.0, 8597.0, 0.0971628449280995, 0.12686203483287992, 0.02780147808977847], "isController": false}, {"data": ["J09 01 /api/inventory", 32, 0, 0.0, 871.9375000000002, 137, 10864, 237.5, 2808.7999999999997, 5755.649999999983, 10864.0, 0.09954798990832252, 0.7698442696132872, 0.026928508988872404], "isController": false}, {"data": ["J09 02 /api/pos/orders", 32, 0, 0.0, 773.65625, 131, 9089, 202.0, 1932.0999999999997, 5253.999999999987, 9089.0, 0.09950310636260176, 2.0515713717125106, 0.02701353864140946], "isController": false}, {"data": ["J01 01 /api/public/landing", 145, 0, 0.0, 993.1379310344827, 157, 10524, 282.0, 3108.000000000001, 4832.599999999998, 10408.079999999998, 0.4025340210650218, 4.382274674641467, 0.11090018318768079], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 14, 0, 0.0, 8802.285714285716, 1874, 51438, 3742.0, 37940.5, 51438.0, 51438.0, 0.03841373236055129, 1.8652042838857137, 0.01110396951047186], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 108, 0, 0.0, 5465.842592592594, 1003, 40926, 1867.0, 17088.400000000012, 29518.149999999994, 40380.77999999998, 0.30127623962619426, 0.8712580200850826, 0.08477752981379454], "isController": false}, {"data": ["J04 01 /api/membership-applications", 34, 0, 0.0, 973.1470588235294, 123, 13596, 221.0, 1693.5, 8786.25, 13596.0, 0.09856243785493349, 1.0002547404184265, 0.02800944278885317], "isController": false}, {"data": ["J06 01 /api/financial-records", 34, 0, 0.0, 903.5294117647059, 130, 11737, 208.0, 2448.5, 6768.25, 11737.0, 0.09816602762507508, 1.1649546559569457, 0.02732159948549453], "isController": false}, {"data": ["J10 03 /api/activities", 32, 0, 0.0, 629.1562500000001, 81, 7198, 130.0, 1671.4999999999998, 3959.6999999999894, 7198.0, 0.09860595826502817, 0.11439831876841158, 0.026769976950857255], "isController": false}, {"data": ["TX_J10", 32, 0, 0.0, 4364.749999999999, 587, 26584, 1120.5, 17269.399999999998, 21998.249999999985, 26584.0, 0.09825746526445076, 2.4645088086282336, 0.0802180087510555], "isController": true}, {"data": ["SETUP login", 10, 0, 0.0, 561.4, 380, 885, 547.0, 884.7, 885.0, 885.0, 0.18786751582783823, 0.2993037747280618, 0.05799308764958951], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 103, 0, 0.0, 1110.766990291262, 195, 12897, 374.0, 2874.0000000000136, 6308.399999999996, 12768.43999999998, 0.31194066464561415, 0.37164805748793883, 0.09295933546795643], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 104, 0, 0.0, 949.8846153846152, 196, 8418, 371.0, 2394.5, 4885.0, 8366.950000000003, 0.30671680306716803, 0.46855415468554157, 0.09020404777704048], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 935, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
