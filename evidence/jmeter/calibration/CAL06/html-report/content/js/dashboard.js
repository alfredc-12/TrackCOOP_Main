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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.7981072555205048, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.16666666666666666, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.3333333333333333, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [1.0, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J01"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.14285714285714285, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.6904761904761905, 500, 1500, "TX_J05"], "isController": true}, {"data": [1.0, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.8, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [1.0, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.3333333333333333, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [1.0, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [1.0, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.5, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.0, 500, 1500, "SETUP login"], "isController": false}, {"data": [1.0, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.9761904761904762, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 182, 0, 0.0, 668.1813186813184, 39, 8280, 233.5, 1918.7, 2379.7999999999997, 8152.1799999999985, 1.8151716434284801, 12.752280106790936, 0.5108092162348153], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 3, 0, 0.0, 1581.6666666666667, 1097, 1899, 1749.0, 1899.0, 1899.0, 1899.0, 0.04197213050534445, 2.4967269389375457, 0.012009603748111254], "isController": false}, {"data": ["TX_J09", 5, 0, 0.0, 374.2, 285, 465, 391.0, 465.0, 465.0, 465.0, 0.09528528414071731, 2.7014866886458058, 0.051643879587986434], "isController": true}, {"data": ["J02 01 /api/auth/me", 28, 0, 0.0, 53.42857142857142, 39, 111, 46.5, 78.30000000000001, 101.54999999999994, 111.0, 0.35078927587070907, 0.4647908967050865, 0.09420610435980958], "isController": false}, {"data": ["TX_J04", 7, 0, 0.0, 233.0, 173, 292, 255.0, 292.0, 292.0, 292.0, 0.0890777903617831, 0.904000388124658, 0.02531409862820203], "isController": true}, {"data": ["TX_J03", 21, 0, 0.0, 1478.8571428571427, 1000, 2384, 1188.0, 2326.0, 2381.2, 2384.0, 0.26840147748622845, 0.7761101316764868, 0.07548791554300176], "isController": true}, {"data": ["TX_J02", 30, 0, 0.0, 49.86666666666667, 0, 111, 45.5, 75.90000000000002, 99.44999999999999, 111.0, 0.3431551976573939, 0.4243641262696742, 0.08601220774615666], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 5, 0, 0.0, 142.8, 129, 167, 134.0, 167.0, 167.0, 167.0, 0.0954617484773851, 0.6883687019111442, 0.026475719304274777], "isController": false}, {"data": ["TX_J01", 31, 0, 0.0, 226.90322580645162, 0, 482, 209.0, 348.8, 405.79999999999984, 482.0, 0.3476622517299001, 3.662807568943667, 0.09265444334787533], "isController": true}, {"data": ["TX_J08", 5, 0, 0.0, 142.8, 129, 167, 134.0, 167.0, 167.0, 167.0, 0.09547086229282822, 0.6884344210646911, 0.026478246964026578], "isController": true}, {"data": ["TX_J07", 3, 0, 0.0, 5007.666666666667, 4399, 5325, 5299.0, 5325.0, 5325.0, 5325.0, 0.03997175329433866, 4.3185888222322895, 0.022991565127310036], "isController": true}, {"data": ["TX_J06", 7, 0, 0.0, 1837.9999999999998, 138, 2202, 2148.0, 2202.0, 2202.0, 2202.0, 0.08922880815806246, 1.158754580943276, 0.04671815248565966], "isController": true}, {"data": ["TX_J05", 21, 0, 0.0, 585.3333333333333, 427, 881, 549.0, 829.8000000000001, 877.4, 881.0, 0.27422661565181056, 0.74555361130336, 0.16228645418456758], "isController": true}, {"data": ["J10 01 /api/documents", 5, 0, 0.0, 252.8, 209, 310, 265.0, 310.0, 310.0, 310.0, 0.09564984504725102, 1.100664437626736, 0.025874030349695834], "isController": false}, {"data": ["J10 02 /api/announcements", 5, 0, 0.0, 505.0, 483, 561, 485.0, 561.0, 561.0, 561.0, 0.09525260992151184, 1.1796254369713481, 0.026138655652289875], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 6, 0, 0.0, 1914.1666666666665, 1846, 1956, 1918.5, 1956.0, 1956.0, 1956.0, 0.08355847700749242, 0.10909930054591539, 0.023908822034370388], "isController": false}, {"data": ["J09 01 /api/inventory", 5, 0, 0.0, 205.0, 136, 267, 230.0, 267.0, 267.0, 267.0, 0.09552558175079286, 0.7387373846528601, 0.0258404161571969], "isController": false}, {"data": ["J09 02 /api/pos/orders", 5, 0, 0.0, 169.2, 130, 198, 175.0, 198.0, 198.0, 198.0, 0.0957267575432685, 1.9737099921982693, 0.025988318942410785], "isController": false}, {"data": ["J01 01 /api/public/landing", 30, 0, 0.0, 234.46666666666667, 167, 482, 210.0, 350.90000000000003, 412.1499999999999, 482.0, 0.34189203049676914, 3.7220823788847484, 0.09415385996102431], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 3, 0, 0.0, 3426.0, 3302, 3576, 3400.0, 3576.0, 3576.0, 3576.0, 0.04101161995898838, 1.9913464413875597, 0.011854921394395078], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 21, 0, 0.0, 1478.8571428571427, 1000, 2384, 1188.0, 2326.0, 2381.2, 2384.0, 0.26838775640616014, 0.776070455779922, 0.07548405648923254], "isController": false}, {"data": ["J04 01 /api/membership-applications", 7, 0, 0.0, 233.0, 173, 292, 255.0, 292.0, 292.0, 292.0, 0.0890777903617831, 0.904000388124658, 0.02531409862820203], "isController": false}, {"data": ["J06 01 /api/financial-records", 7, 0, 0.0, 197.2857142857143, 128, 250, 226.0, 250.0, 250.0, 250.0, 0.08922880815806246, 1.0588949968132568, 0.02483418977055449], "isController": false}, {"data": ["J10 03 /api/activities", 5, 0, 0.0, 97.6, 90, 104, 97.0, 104.0, 104.0, 104.0, 0.09593798568605254, 0.1113030537060844, 0.02604566408273692], "isController": false}, {"data": ["TX_J10", 5, 0, 0.0, 855.4, 819, 896, 852.0, 896.0, 896.0, 896.0, 0.09452510586811858, 2.368001597474289, 0.07717088721264367], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 6669.8, 5210, 8280, 6244.0, 8280.0, 8280.0, 8280.0, 0.6016123210203345, 0.958349627000361, 0.18565380218986885], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 21, 0, 0.0, 286.80952380952374, 216, 446, 262.0, 391.6, 440.8999999999999, 446.0, 0.27582583568660934, 0.32862062454849933, 0.08215515613712483], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 21, 0, 0.0, 298.5238095238095, 209, 540, 241.0, 482.00000000000006, 535.1999999999999, 540.0, 0.27499869048242626, 0.42001753116651824, 0.08083457601094757], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 182, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
