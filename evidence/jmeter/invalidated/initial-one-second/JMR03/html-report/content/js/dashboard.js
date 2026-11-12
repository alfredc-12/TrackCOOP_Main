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

    var data = {"OkPercent": 73.35329341317366, "KoPercent": 26.646706586826348};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.6353986135181976, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.35714285714285715, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.5531914893617021, 500, 1500, "TX_J09"], "isController": true}, {"data": [0.7821782178217822, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [0.5714285714285714, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.42810457516339867, 500, 1500, "TX_J03"], "isController": true}, {"data": [0.7821782178217822, 500, 1500, "TX_J02"], "isController": true}, {"data": [0.574468085106383, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.7843137254901961, 500, 1500, "TX_J01"], "isController": true}, {"data": [0.5833333333333334, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.8223684210526315, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.5531914893617021, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.5531914893617021, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [0.5531914893617021, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [0.5531914893617021, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.7821782178217822, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.4243421052631579, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [0.5714285714285714, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [0.5714285714285714, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [0.5531914893617021, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.2765957446808511, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.8, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.8486842105263158, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.8486842105263158, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 1336, 356, 26.646706586826348, 266.14520958083835, 0, 3239, 147.0, 973.0, 1058.0, 1940.5199999999995, 3.671035638721732, 19.097164976781247, 1.029497538159811], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 21, 6, 28.571428571428573, 730.7142857142856, 1, 1182, 969.0, 1131.0, 1177.1999999999998, 1182.0, 0.05967485727763301, 2.5555596675755243, 0.01707493474838523], "isController": false}, {"data": ["TX_J09", 47, 21, 44.680851063829785, 150.63829787234044, 1, 325, 258.0, 276.8, 299.59999999999997, 325.0, 0.13906642048951381, 2.3270509338162193, 0.0753729134489064], "isController": true}, {"data": ["J02 01 /api/auth/me", 202, 44, 21.782178217821784, 35.61881188118811, 0, 84, 43.0, 49.70000000000002, 53.0, 81.42999999999998, 0.5620228370467647, 0.7261209634170432, 0.15093386737095732], "isController": false}, {"data": ["TX_J04", 49, 21, 42.857142857142854, 75.61224489795919, 0, 143, 123.0, 135.0, 139.0, 143.0, 0.13746668536961706, 0.8663694285664189, 0.0390652396899986], "isController": true}, {"data": ["TX_J03", 153, 23, 15.032679738562091, 835.7843137254902, 0, 1288, 975.0, 1068.6, 1111.1999999999998, 1246.9600000000005, 0.4539668693198508, 1.186922620160283, 0.1268436840746642], "isController": true}, {"data": ["TX_J02", 202, 44, 21.782178217821784, 35.61881188118811, 0, 84, 43.0, 49.70000000000002, 53.0, 81.42999999999998, 0.5620322194707994, 0.7261330852995186, 0.15093638706491194], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 47, 20, 42.5531914893617, 77.29787234042551, 1, 144, 127.0, 139.2, 142.79999999999998, 144.0, 0.138994860147512, 0.6452454007857645, 0.03854935574403653], "isController": false}, {"data": ["TX_J01", 204, 44, 21.568627450980394, 136.80882352941168, 0, 314, 171.0, 183.5, 190.75, 263.74999999999994, 0.5638941869143379, 4.897510741458662, 0.15376871009204743], "isController": true}, {"data": ["TX_J08", 48, 20, 41.666666666666664, 75.68749999999999, 0, 144, 127.0, 139.1, 142.64999999999998, 144.0, 0.13743854635830802, 0.6247285454492093, 0.037323602636529445], "isController": true}, {"data": ["TX_J07", 21, 6, 28.571428571428573, 2197.6190476190477, 2, 4314, 2964.0, 3170.0, 4201.299999999998, 4314.0, 0.05934751644774027, 4.619761477739029, 0.03413641326925686], "isController": true}, {"data": ["TX_J06", 49, 21, 42.857142857142854, 1192.8979591836733, 2, 2397, 1970.0, 2062.0, 2095.5, 2397.0, 0.1375268738738233, 1.173996996686725, 0.07762747372956043], "isController": true}, {"data": ["TX_J05", 152, 23, 15.131578947368421, 369.28947368421035, 1, 599, 425.5, 457.5000000000001, 502.35, 571.4399999999999, 0.4562071180315863, 1.2147722097082074, 0.26998194680384896], "isController": true}, {"data": ["J10 01 /api/documents", 47, 21, 44.680851063829785, 123.23404255319151, 1, 260, 206.0, 230.0, 252.59999999999994, 260.0, 0.13917225082985157, 0.9582174875485252, 0.037647181132684455], "isController": false}, {"data": ["J10 02 /api/announcements", 47, 21, 44.680851063829785, 145.72340425531917, 0, 293, 244.0, 277.0, 282.79999999999995, 293.0, 0.13927617873578715, 1.0656965920304393, 0.03821934201636347], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 49, 20, 40.816326530612244, 1115.673469387755, 0, 2273, 1842.0, 1926.0, 1966.5, 2273.0, 0.1375867287772471, 0.1722576192160926, 0.0393680776677084], "isController": false}, {"data": ["J09 01 /api/inventory", 47, 21, 44.680851063829785, 76.08510638297872, 0, 189, 125.0, 142.0, 145.99999999999997, 189.0, 0.13906518606626012, 0.6679047074305192, 0.037618219277689505], "isController": false}, {"data": ["J09 02 /api/pos/orders", 47, 21, 44.680851063829785, 74.55319148936171, 1, 164, 127.0, 138.4, 145.19999999999996, 164.0, 0.13911746249748405, 1.6597492574235446, 0.0377682173577154], "isController": false}, {"data": ["J01 01 /api/public/landing", 202, 44, 21.782178217821784, 138.16336633663357, 0, 314, 171.0, 183.70000000000002, 190.85, 263.85, 0.5617040209109615, 4.926790670534175, 0.15468802138368276], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 21, 6, 28.571428571428573, 1466.9047619047622, 1, 3239, 1938.0, 2067.8, 3121.8999999999983, 3239.0, 0.05952566548276732, 2.084458482088444, 0.01720663767861243], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 152, 23, 15.131578947368421, 841.2828947368421, 0, 1288, 975.0, 1070.2000000000003, 1111.4, 1247.7199999999998, 0.45563002841692546, 1.1991083552655244, 0.1281459454922603], "isController": false}, {"data": ["J04 01 /api/membership-applications", 49, 21, 42.857142857142854, 75.61224489795919, 0, 143, 123.0, 135.0, 139.0, 143.0, 0.13746745668372384, 0.8663742896930268, 0.039065458881800436], "isController": false}, {"data": ["J06 01 /api/financial-records", 49, 21, 42.857142857142854, 77.2244897959184, 1, 157, 125.0, 139.0, 149.5, 157.0, 0.13752764586350522, 1.0018199389475486, 0.03827673737412011], "isController": false}, {"data": ["J10 03 /api/activities", 47, 21, 44.680851063829785, 51.170212765957444, 0, 130, 84.0, 96.4, 109.0, 130.0, 0.13938480883521748, 0.16259437204177984, 0.037840797711123496], "isController": false}, {"data": ["TX_J10", 47, 21, 44.680851063829785, 320.12765957446805, 2, 613, 539.0, 602.2, 610.4, 613.0, 0.13917266293565483, 2.185471748134494, 0.11362143184981198], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 478.8, 339, 688, 423.0, 688.0, 688.0, 688.0, 0.10573507020808662, 0.16925871785653868, 0.03262918182202673], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 152, 23, 15.131578947368421, 184.2894736842105, 1, 359, 212.0, 227.0, 235.35, 347.87, 0.4565071794763983, 0.5427093954508458, 0.13597137669951315], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 152, 23, 15.131578947368421, 184.99342105263162, 0, 318, 213.0, 230.10000000000005, 250.0, 316.40999999999997, 0.4565112926477655, 0.672867869826706, 0.13418935457712639], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["429/Too Many Requests", 356, 100.0, 26.646706586826348], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 1336, 356, "429/Too Many Requests", 356, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 21, 6, "429/Too Many Requests", 6, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": ["J02 01 /api/auth/me", 202, 44, "429/Too Many Requests", 44, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["J08 01 /api/rental/schedules", 47, 20, "429/Too Many Requests", 20, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["J10 01 /api/documents", 47, 21, "429/Too Many Requests", 21, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J10 02 /api/announcements", 47, 21, "429/Too Many Requests", 21, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 49, 20, "429/Too Many Requests", 20, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J09 01 /api/inventory", 47, 21, "429/Too Many Requests", 21, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J09 02 /api/pos/orders", 47, 21, "429/Too Many Requests", 21, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J01 01 /api/public/landing", 202, 44, "429/Too Many Requests", 44, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 21, 6, "429/Too Many Requests", 6, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 152, 23, "429/Too Many Requests", 23, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J04 01 /api/membership-applications", 49, 21, "429/Too Many Requests", 21, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J06 01 /api/financial-records", 49, 21, "429/Too Many Requests", 21, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J10 03 /api/activities", 47, 21, "429/Too Many Requests", 21, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 152, 23, "429/Too Many Requests", 23, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 152, 23, "429/Too Many Requests", 23, "", "", "", "", "", "", "", ""], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
