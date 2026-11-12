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

    var data = {"OkPercent": 99.54545454545455, "KoPercent": 0.45454545454545453};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.6133032694475761, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.10869565217391304, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.6132075471698113, 500, 1500, "TX_J09"], "isController": true}, {"data": [0.9194915254237288, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [0.7758620689655172, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.16292134831460675, 500, 1500, "TX_J03"], "isController": true}, {"data": [0.919831223628692, 500, 1500, "TX_J02"], "isController": true}, {"data": [0.7870370370370371, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.73125, 500, 1500, "TX_J01"], "isController": true}, {"data": [0.7870370370370371, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.017241379310344827, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.38529411764705884, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.7019230769230769, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.56, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [0.8207547169811321, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [0.7641509433962265, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.7289915966386554, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.14857142857142858, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [0.7758620689655172, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [0.8189655172413793, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [0.82, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.28, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.85, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.7235294117647059, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.7382352941176471, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 1540, 7, 0.45454545454545453, 2441.8214285714275, 40, 60023, 400.0, 4319.100000000006, 12920.549999999996, 41682.77, 3.9175881902523284, 27.687167485957737, 1.0970543719584633], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 23, 0, 0.0, 5814.869565217391, 1242, 57045, 2212.0, 13454.200000000008, 48768.99999999988, 57045.0, 0.06774987922847617, 4.030105247964558, 0.019417106181734634], "isController": false}, {"data": ["TX_J09", 53, 1, 1.8867924528301887, 3342.1698113207544, 283, 79861, 531.0, 7355.2, 13927.299999999997, 79861.0, 0.1562527639050219, 4.376810588114766, 0.084022712665908], "isController": true}, {"data": ["J02 01 /api/auth/me", 236, 0, 0.0, 319.8940677966102, 40, 6963, 88.0, 664.5000000000007, 1465.3499999999985, 4879.039999999999, 0.6634897875989261, 0.8796104721039093, 0.17853197173842758], "isController": false}, {"data": ["TX_J04", 58, 0, 0.0, 1358.7241379310344, 132, 23607, 294.0, 3675.6000000000013, 6623.499999999981, 23607.0, 0.16486687000247302, 1.673099487384842, 0.04692954108738229], "isController": true}, {"data": ["TX_J03", 178, 4, 2.247191011235955, 7558.921348314607, 0, 60023, 1888.5, 31471.499999999996, 43786.54999999996, 60016.68, 0.46859739322955746, 1.329568491399395, 0.12685437793037904], "isController": true}, {"data": ["TX_J02", 237, 0, 0.0, 318.54852320675093, 0, 6963, 88.0, 659.0000000000009, 1461.8999999999996, 4875.960000000001, 0.6641278488142376, 0.8767413652871303, 0.17794963749688253], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 54, 1, 1.8518518518518519, 2874.6111111111113, 102, 60014, 244.5, 7872.5, 22670.75, 60014.0, 0.15665750897154346, 1.1162442459189268, 0.04271421554477649], "isController": false}, {"data": ["TX_J01", 240, 0, 0.0, 1375.9041666666667, 0, 16379, 365.5, 3244.9, 10036.54999999999, 14267.02, 0.6673841045790893, 7.204886094565547, 0.1826073271822765], "isController": true}, {"data": ["TX_J08", 54, 1, 1.8518518518518519, 2874.6111111111113, 102, 60014, 244.5, 7872.5, 22670.75, 60014.0, 0.15665614556256963, 1.1162345311122006, 0.042713843797867156], "isController": true}, {"data": ["TX_J07", 23, 0, 0.0, 18260.130434782608, 3547, 90235, 5692.0, 66907.20000000003, 86803.19999999995, 90235.0, 0.06126177957478998, 6.618745867326962, 0.035294713274894925], "isController": true}, {"data": ["TX_J06", 58, 0, 0.0, 3347.5517241379303, 403, 16176, 2307.5, 6173.100000000004, 11011.099999999997, 16176.0, 0.1647451137451393, 2.166343323313706, 0.09233071551927376], "isController": true}, {"data": ["TX_J05", 170, 1, 0.5882352941176471, 3869.352941176471, 470, 51993, 898.0, 9297.900000000001, 32561.049999999996, 44246.899999999914, 0.4946087644673064, 1.3439845300198425, 0.2932420804408419], "isController": true}, {"data": ["J10 01 /api/documents", 52, 0, 0.0, 3328.769230769231, 229, 40635, 421.0, 15608.80000000001, 23197.649999999987, 40635.0, 0.1519987840097279, 1.7489822521323675, 0.041185367632443556], "isController": false}, {"data": ["J10 02 /api/announcements", 50, 0, 0.0, 2032.48, 282, 16513, 639.0, 5598.199999999999, 13451.099999999984, 16513.0, 0.15808827016653018, 1.957756492290035, 0.04345574832663566], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 57, 0, 0.0, 2652.4210526315783, 1864, 9949, 1997.0, 4645.600000000001, 7488.099999999995, 9949.0, 0.16255432736730432, 0.21218564363671105, 0.046587321618014446], "isController": false}, {"data": ["J09 01 /api/inventory", 53, 0, 0.0, 1328.7547169811319, 142, 19852, 262.0, 3872.800000000001, 8926.599999999988, 19852.0, 0.15697006314342915, 1.2138484107891743, 0.0425310432363673], "isController": false}, {"data": ["J09 02 /api/pos/orders", 53, 1, 1.8867924528301887, 2013.4150943396226, 127, 60009, 249.0, 3143.4, 7175.099999999996, 60009.0, 0.15642754895739563, 3.172053355998111, 0.041732651852781015], "isController": false}, {"data": ["J01 01 /api/public/landing", 238, 0, 0.0, 1387.466386554622, 165, 16379, 367.5, 3251.2999999999997, 10087.599999999997, 14268.579999999998, 0.6622240153591452, 7.209256397904813, 0.18271809221052046], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 23, 0, 0.0, 12445.260869565216, 2254, 57411, 3507.0, 45863.00000000001, 55658.99999999998, 57411.0, 0.06148910573452746, 2.9856234753041035, 0.017802913213474134], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 175, 4, 2.2857142857142856, 7688.502857142857, 1039, 60023, 1897.0, 31668.000000000004, 44115.199999999975, 60016.92, 0.46070211001566386, 1.3295754917995024, 0.12685504583985993], "isController": false}, {"data": ["J04 01 /api/membership-applications", 58, 0, 0.0, 1358.7241379310344, 132, 23607, 294.0, 3675.6000000000013, 6623.499999999981, 23607.0, 0.16486265235583045, 1.6730566859266987, 0.04692834052949336], "isController": false}, {"data": ["J06 01 /api/financial-records", 58, 0, 0.0, 740.8620689655173, 143, 6227, 281.5, 2037.6000000000004, 4116.099999999994, 6227.0, 0.16474464579901152, 1.9550001242685906, 0.04592944917059592], "isController": false}, {"data": ["J10 03 /api/activities", 50, 0, 0.0, 808.86, 80, 13854, 168.0, 2327.2999999999997, 3498.599999999998, 13854.0, 0.15819330589206787, 0.18349187598277591, 0.043021163891428765], "isController": false}, {"data": ["TX_J10", 50, 0, 0.0, 5884.92, 621, 58455, 1332.5, 30351.6, 32707.94999999999, 58455.0, 0.15791302150775355, 3.955844558317279, 0.12914324290180967], "isController": true}, {"data": ["SETUP login", 20, 0, 0.0, 547.1000000000001, 350, 1402, 463.5, 820.8000000000001, 1373.0999999999995, 1402.0, 0.35568202027387513, 0.5668855870976347, 0.1099522885914992], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 170, 0, 0.0, 2078.9176470588236, 223, 27293, 410.5, 6372.600000000002, 15301.649999999998, 25172.939999999977, 0.49508698969636605, 0.5896990007615602, 0.1477297713280563], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 170, 1, 0.5882352941176471, 1790.4294117647062, 215, 36753, 426.5, 2735.5, 13557.399999999996, 30854.319999999934, 0.5037813233446339, 0.7688539928744578, 0.14835619117612195], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["500/Internal Server Error", 1, 14.285714285714286, 0.06493506493506493], "isController": false}, {"data": ["Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 6, 85.71428571428571, 0.38961038961038963], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 1540, 7, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 6, "500/Internal Server Error", 1, "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["J08 01 /api/rental/schedules", 54, 1, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["J09 02 /api/pos/orders", 53, 1, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 175, 4, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 4, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 170, 1, "500/Internal Server Error", 1, "", "", "", "", "", "", "", ""], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
