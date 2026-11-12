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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.7825396825396825, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.16666666666666666, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.2619047619047619, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [1.0, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J01"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.14285714285714285, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.6190476190476191, 500, 1500, "TX_J05"], "isController": true}, {"data": [1.0, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.7, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [1.0, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.2619047619047619, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [1.0, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [1.0, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.5, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.0, 500, 1500, "SETUP login"], "isController": false}, {"data": [1.0, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [1.0, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 181, 0, 0.0, 667.127071823205, 39, 7377, 234.0, 1870.0, 2242.6000000000004, 7347.4800000000005, 1.8459216350174394, 12.928930981270524, 0.5195239995308707], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 3, 0, 0.0, 1447.6666666666667, 976, 1697, 1670.0, 1697.0, 1697.0, 1697.0, 0.0427667217882192, 2.5439934807478477, 0.012236962386668188], "isController": false}, {"data": ["TX_J09", 5, 0, 0.0, 388.8, 367, 428, 382.0, 428.0, 428.0, 428.0, 0.09427558639414736, 2.672860179877819, 0.05109663129760917], "isController": true}, {"data": ["J02 01 /api/auth/me", 28, 0, 0.0, 54.0, 39, 115, 47.0, 87.60000000000001, 105.09999999999994, 115.0, 0.35441243481342716, 0.46959153175788565, 0.09517912067743405], "isController": false}, {"data": ["TX_J04", 7, 0, 0.0, 218.14285714285714, 124, 346, 215.0, 346.0, 346.0, 346.0, 0.08834368216467263, 0.8965503369680448, 0.02510547999015599], "isController": true}, {"data": ["TX_J03", 21, 0, 0.0, 1448.4761904761906, 903, 2187, 1184.0, 2016.2, 2171.1, 2187.0, 0.27201720184971695, 0.7865653658955195, 0.0765048380202329], "isController": true}, {"data": ["TX_J02", 29, 0, 0.0, 52.13793103448276, 0, 115, 47.0, 87.0, 104.0, 115.0, 0.33606823343994807, 0.4299310408264961, 0.08714053736151671], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 5, 0, 0.0, 136.2, 125, 149, 139.0, 149.0, 149.0, 149.0, 0.09477056047309464, 0.6833845884114559, 0.026284022631209842], "isController": false}, {"data": ["TX_J01", 31, 0, 0.0, 204.25806451612897, 0, 437, 189.0, 289.20000000000005, 388.39999999999986, 437.0, 0.351816964387044, 3.5830270303243523, 0.09063631346891526], "isController": true}, {"data": ["TX_J08", 5, 0, 0.0, 136.4, 125, 149, 139.0, 149.0, 149.0, 149.0, 0.09477235679896888, 0.6833975416050646, 0.026284520830964022], "isController": true}, {"data": ["TX_J07", 3, 0, 0.0, 4520.333333333333, 4027, 4917, 4617.0, 4917.0, 4917.0, 4917.0, 0.04098416645036135, 4.427970967841091, 0.02357390042896761], "isController": true}, {"data": ["TX_J06", 7, 0, 0.0, 1966.7142857142858, 216, 2547, 2184.0, 2547.0, 2547.0, 2547.0, 0.08835706351610623, 1.1474338189816218, 0.046261727033474705], "isController": true}, {"data": ["TX_J05", 21, 0, 0.0, 580.047619047619, 421, 756, 579.0, 690.6, 749.6999999999999, 756.0, 0.27736320050717844, 0.7540812013788915, 0.16414267530014662], "isController": true}, {"data": ["J10 01 /api/documents", 5, 0, 0.0, 241.0, 228, 259, 234.0, 259.0, 259.0, 259.0, 0.09446438692612885, 1.0870231024466277, 0.025553354666540715], "isController": false}, {"data": ["J10 02 /api/announcements", 5, 0, 0.0, 467.6, 276, 544, 509.0, 544.0, 544.0, 544.0, 0.09401854045617795, 1.164342498965796, 0.0258000096369004], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 6, 0, 0.0, 2027.3333333333335, 1851, 2245, 1977.5, 2245.0, 2245.0, 2245.0, 0.08381410032547809, 0.1094330587257463, 0.02398196425328621], "isController": false}, {"data": ["J09 01 /api/inventory", 5, 0, 0.0, 240.4, 206, 281, 238.0, 281.0, 281.0, 281.0, 0.0945340417084192, 0.7310694104384489, 0.025572196829328243], "isController": false}, {"data": ["J09 02 /api/pos/orders", 5, 0, 0.0, 148.4, 129, 165, 147.0, 165.0, 165.0, 165.0, 0.0946969696969697, 1.9524776574337122, 0.02570874763257576], "isController": false}, {"data": ["J01 01 /api/public/landing", 29, 0, 0.0, 218.31034482758616, 162, 437, 197.0, 295.0, 396.5, 437.0, 0.3347763347763347, 3.6446158008658007, 0.09219426406926406], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 3, 0, 0.0, 3072.6666666666665, 2947, 3220, 3051.0, 3220.0, 3220.0, 3220.0, 0.041935168229916546, 2.0361899409762505, 0.012121884566460251], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 21, 0, 0.0, 1448.4761904761906, 903, 2187, 1184.0, 2016.2, 2171.1, 2187.0, 0.27204186853900564, 0.7866366921328082, 0.07651177552659533], "isController": false}, {"data": ["J04 01 /api/membership-applications", 7, 0, 0.0, 218.14285714285714, 124, 346, 215.0, 346.0, 346.0, 346.0, 0.08833810779773096, 0.8964937658535355, 0.025103895868300502], "isController": false}, {"data": ["J06 01 /api/financial-records", 7, 0, 0.0, 229.0, 187, 302, 216.0, 302.0, 302.0, 302.0, 0.08836710219024174, 1.0486689705232595, 0.024594359496307516], "isController": false}, {"data": ["J10 03 /api/activities", 5, 0, 0.0, 102.0, 80, 130, 95.0, 130.0, 130.0, 130.0, 0.0947633758505013, 0.10994032276405816, 0.02572677586566344], "isController": false}, {"data": ["TX_J10", 5, 0, 0.0, 810.6, 638, 898, 866.0, 898.0, 898.0, 898.0, 0.09338812103100486, 2.3395183507657826, 0.0762426456854688], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 6955.0, 6293, 7377, 7307.0, 7377.0, 7377.0, 7377.0, 0.5442473059758355, 0.8669689506911942, 0.16795131707848046], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 21, 0, 0.0, 270.5238095238096, 199, 414, 236.0, 374.6, 410.69999999999993, 414.0, 0.2788178124751055, 0.3321852843941687, 0.08304632109854218], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 21, 0, 0.0, 309.5238095238095, 209, 451, 308.0, 417.40000000000003, 447.9, 451.0, 0.27813832746152417, 0.4248128360838124, 0.08175745758390507], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 181, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
