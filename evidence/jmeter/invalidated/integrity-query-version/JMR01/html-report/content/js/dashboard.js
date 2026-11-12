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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8526785714285714, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.18181818181818182, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.4880952380952381, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [1.0, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J01"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.9702380952380952, 500, 1500, "TX_J05"], "isController": true}, {"data": [1.0, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [1.0, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [1.0, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.4880952380952381, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [1.0, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [1.0, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.5, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.9, 500, 1500, "SETUP login"], "isController": false}, {"data": [1.0, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [1.0, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 712, 0, 0.0, 377.12921348314615, 36, 3286, 196.0, 1002.7, 1836.4, 1958.22, 1.9665683382497543, 13.884076907460805, 0.5518754686826753], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 11, 0, 0.0, 1440.2727272727273, 985, 1741, 1592.0, 1735.4, 1741.0, 1741.0, 0.03270354238825051, 1.9453817163042022, 0.009357556562263085], "isController": false}, {"data": ["TX_J09", 25, 0, 0.0, 293.5599999999999, 120, 418, 269.0, 398.6000000000001, 417.4, 418.0, 0.07445705912486152, 2.0495672509188, 0.03954658722346648], "isController": true}, {"data": ["J02 01 /api/auth/me", 109, 0, 0.0, 44.412844036697244, 36, 95, 44.0, 48.0, 50.5, 91.30000000000021, 0.3106537123118621, 0.4115905630384783, 0.08342751063062703], "isController": false}, {"data": ["TX_J04", 25, 0, 0.0, 143.84000000000003, 117, 242, 131.0, 216.40000000000003, 236.29999999999998, 242.0, 0.07280881860410933, 0.7388957450526408, 0.020690787318159976], "isController": true}, {"data": ["TX_J03", 84, 0, 0.0, 1013.3452380952381, 890, 1914, 991.0, 1082.0, 1158.75, 1914.0, 0.2551903902590183, 0.737908931207962, 0.07177229726034888], "isController": true}, {"data": ["TX_J02", 109, 0, 0.0, 44.412844036697244, 36, 95, 44.0, 48.0, 50.5, 91.30000000000021, 0.31066079546264236, 0.4115999476294301, 0.08342941284397133], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 25, 0, 0.0, 143.15999999999997, 121, 236, 133.0, 198.40000000000006, 230.29999999999998, 236.0, 0.07444730322088812, 0.536834850569373, 0.02064749425266819], "isController": false}, {"data": ["TX_J01", 109, 0, 0.0, 171.98165137614674, 155, 270, 172.0, 182.0, 186.5, 264.3000000000003, 0.3105006181526068, 3.3803329015285746, 0.08550895929593273], "isController": true}, {"data": ["TX_J08", 25, 0, 0.0, 143.15999999999997, 121, 236, 133.0, 198.40000000000006, 230.29999999999998, 236.0, 0.07444996366841773, 0.536854034890231, 0.02064823211116273], "isController": true}, {"data": ["TX_J07", 11, 0, 0.0, 3844.181818181818, 2820, 5007, 3471.0, 5002.6, 5007.0, 5007.0, 0.03251474987289688, 3.5129265990606195, 0.01870233171400026], "isController": true}, {"data": ["TX_J06", 25, 0, 0.0, 2021.8799999999999, 1964, 2127, 1997.0, 2114.6, 2124.0, 2127.0, 0.07241108642697631, 0.9538604929819176, 0.04087266401835187], "isController": true}, {"data": ["TX_J05", 84, 0, 0.0, 423.49999999999994, 199, 643, 422.0, 456.0, 513.25, 643.0, 0.2565331981444099, 0.6865340876121951, 0.14908665878488775], "isController": true}, {"data": ["J10 01 /api/documents", 23, 0, 0.0, 222.21739130434784, 198, 294, 216.0, 266.00000000000006, 292.79999999999995, 294.0, 0.07410629420198799, 0.8525087145377217, 0.0200463315370612], "isController": false}, {"data": ["J10 02 /api/announcements", 23, 0, 0.0, 333.7391304347826, 234, 481, 270.0, 476.2, 480.6, 481.0, 0.07410462283968915, 0.9305900711484927, 0.020335350603469384], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 25, 0, 0.0, 1864.4, 1835, 1902, 1857.0, 1898.8, 1901.4, 1902.0, 0.0724591475326211, 0.09460730493272893, 0.020732939674861315], "isController": false}, {"data": ["J09 01 /api/inventory", 25, 0, 0.0, 159.55999999999997, 120, 270, 135.0, 232.20000000000005, 262.79999999999995, 270.0, 0.07445461990916535, 0.5757872412701959, 0.02014055636214727], "isController": false}, {"data": ["J09 02 /api/pos/orders", 24, 0, 0.0, 139.58333333333337, 119, 287, 131.0, 168.5, 262.75, 287.0, 0.07165184369150299, 1.4773294686120144, 0.019452356002185384], "isController": false}, {"data": ["J01 01 /api/public/landing", 109, 0, 0.0, 171.97247706422024, 155, 270, 172.0, 182.0, 186.5, 264.3000000000003, 0.3105103479710001, 3.38043882732491, 0.08551163879670118], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 11, 0, 0.0, 2403.909090909091, 1819, 3286, 2027.0, 3282.0, 3286.0, 3286.0, 0.03266751008238152, 1.5861926453184487, 0.00944295213318841], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 84, 0, 0.0, 1013.3452380952381, 890, 1914, 991.0, 1082.0, 1158.75, 1914.0, 0.25518186264532455, 0.7378842727468808, 0.07176989886899753], "isController": false}, {"data": ["J04 01 /api/membership-applications", 25, 0, 0.0, 143.84000000000003, 117, 242, 131.0, 216.40000000000003, 236.29999999999998, 242.0, 0.0728098788443616, 0.7389065048345759, 0.020691088616903542], "isController": false}, {"data": ["J06 01 /api/financial-records", 25, 0, 0.0, 157.48000000000002, 122, 237, 135.0, 229.0, 234.6, 237.0, 0.07280351786598328, 0.8639729971752236, 0.0202626978435598], "isController": false}, {"data": ["J10 03 /api/activities", 23, 0, 0.0, 91.8695652173913, 76, 209, 87.0, 97.60000000000002, 187.59999999999968, 209.0, 0.07419378772189587, 0.08607638653673076, 0.020142454088561575], "isController": false}, {"data": ["TX_J10", 23, 0, 0.0, 647.8260869565219, 524, 897, 576.0, 857.8, 889.8, 897.0, 0.07402567725448418, 1.8670613495846518, 0.060435025571043736], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 397.6, 318, 526, 368.0, 526.0, 526.0, 526.0, 0.10555426544786674, 0.1681446462876565, 0.03257338660305263], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 81, 0, 0.0, 217.98765432098767, 191, 358, 214.0, 234.39999999999998, 295.2999999999998, 358.0, 0.25655400461797206, 0.3056600445643808, 0.0764150111410952], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 84, 0, 0.0, 213.297619047619, 190, 377, 213.0, 222.0, 225.75, 377.0, 0.25653633195801356, 0.39181916326399724, 0.07540765226500203], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 712, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
