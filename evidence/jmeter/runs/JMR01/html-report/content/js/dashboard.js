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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8549959382615759, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.5, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.5, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [1.0, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J01"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.9382716049382716, 500, 1500, "TX_J05"], "isController": true}, {"data": [1.0, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [1.0, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [1.0, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.5, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [1.0, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [1.0, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.5, 500, 1500, "TX_J10"], "isController": true}, {"data": [1.0, 500, 1500, "SETUP login"], "isController": false}, {"data": [1.0, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [1.0, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 712, 0, 0.0, 374.8117977528086, 37, 2457, 201.0, 1034.0000000000005, 1845.4500000000003, 2049.27, 1.970345197837048, 13.975514759601282, 0.5527542976770958], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 11, 0, 0.0, 1085.6363636363635, 956, 1358, 1037.0, 1334.4, 1358.0, 1358.0, 0.03343861430382325, 1.9891077276257672, 0.009567884756855676], "isController": false}, {"data": ["TX_J09", 25, 0, 0.0, 280.40000000000003, 148, 447, 277.0, 310.6, 408.5999999999999, 447.0, 0.07441539267514406, 2.04842030539333, 0.039524456804841165], "isController": true}, {"data": ["J02 01 /api/auth/me", 109, 0, 0.0, 49.990825688073386, 37, 186, 45.0, 63.0, 74.5, 180.10000000000034, 0.3090550288073311, 0.40947243916719595, 0.08299817668165631], "isController": false}, {"data": ["TX_J04", 25, 0, 0.0, 142.44, 121, 226, 136.0, 179.4, 213.09999999999997, 226.0, 0.07275034119910023, 0.7383022907627437, 0.020674169227478674], "isController": true}, {"data": ["TX_J03", 84, 0, 0.0, 1037.2142857142856, 905, 1454, 1010.0, 1211.5, 1281.5, 1454.0, 0.2537848689835614, 0.7338447236917239, 0.07137699440162665], "isController": true}, {"data": ["TX_J02", 109, 0, 0.0, 49.990825688073386, 37, 186, 45.0, 63.0, 74.5, 180.10000000000034, 0.30906291556911525, 0.40948288847649, 0.08300029470850263], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 25, 0, 0.0, 141.04, 101, 227, 136.0, 174.2000000000001, 219.79999999999998, 227.0, 0.07440498334816473, 0.5365296846121566, 0.02063575710046756], "isController": false}, {"data": ["TX_J01", 110, 0, 0.0, 182.9181818181819, 0, 340, 176.0, 213.0, 250.45, 339.01, 0.3050065437767574, 3.290333909379783, 0.08323234324050043], "isController": true}, {"data": ["TX_J08", 25, 0, 0.0, 141.04, 101, 227, 136.0, 174.2000000000001, 219.79999999999998, 227.0, 0.07440808369421253, 0.5365520410137357, 0.02063661696206676], "isController": true}, {"data": ["TX_J07", 11, 0, 0.0, 3201.5454545454545, 2948, 3514, 3107.0, 3505.6, 3514.0, 3514.0, 0.03323373284308542, 3.590606249376868, 0.019115887348220034], "isController": true}, {"data": ["TX_J06", 25, 0, 0.0, 2049.9600000000005, 1978, 2549, 2022.0, 2103.8, 2416.7, 2549.0, 0.07237083976227626, 0.9533303296419381, 0.040849946662691095], "isController": true}, {"data": ["TX_J05", 81, 0, 0.0, 451.2716049382716, 397, 558, 442.0, 523.8, 544.8, 558.0, 0.254155122480805, 0.6909842392446887, 0.15040820724938267], "isController": true}, {"data": ["J10 01 /api/documents", 24, 0, 0.0, 236.45833333333334, 203, 305, 228.0, 268.5, 297.25, 305.0, 0.07328333781175954, 0.842874679194555, 0.01982371540415761], "isController": false}, {"data": ["J10 02 /api/announcements", 24, 0, 0.0, 286.1666666666667, 236, 436, 267.5, 350.0, 419.0, 436.0, 0.07328602313395463, 0.9289247957533804, 0.020110715332657476], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 25, 0, 0.0, 1908.3200000000002, 1843, 2427, 1877.0, 1960.4, 2288.0999999999995, 2427.0, 0.07239955286036154, 0.09452949431084313, 0.020715887683677665], "isController": false}, {"data": ["J09 01 /api/inventory", 25, 0, 0.0, 143.20000000000002, 125, 295, 134.0, 162.0, 255.0999999999999, 295.0, 0.07441273469776524, 0.5754633262417997, 0.020129226085235322], "isController": false}, {"data": ["J09 02 /api/pos/orders", 24, 0, 0.0, 142.91666666666666, 125, 171, 140.0, 167.0, 170.75, 171.0, 0.07330034817665385, 1.5113186045446214, 0.019899899212021257], "isController": false}, {"data": ["J01 01 /api/public/landing", 109, 0, 0.0, 184.59633027522943, 153, 340, 176.0, 213.0, 250.5, 339.1, 0.30889475190650406, 3.362850287357136, 0.08506671878675211], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 11, 0, 0.0, 2115.909090909091, 1961, 2457, 2052.0, 2420.4, 2457.0, 2457.0, 0.03336032486890909, 1.619832727350614, 0.009643218907419033], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 84, 0, 0.0, 1037.2142857142856, 905, 1454, 1010.0, 1211.5, 1281.5, 1454.0, 0.25378256876299127, 0.7338380723703292, 0.07137634746459129], "isController": false}, {"data": ["J04 01 /api/membership-applications", 25, 0, 0.0, 142.44, 121, 226, 136.0, 179.4, 213.09999999999997, 226.0, 0.07275118802690048, 0.7383108847417479, 0.02067440987873832], "isController": false}, {"data": ["J06 01 /api/financial-records", 25, 0, 0.0, 141.64, 122, 187, 136.0, 161.0, 180.1, 187.0, 0.07276601070533549, 0.8635278926672235, 0.02025225883888732], "isController": false}, {"data": ["J10 03 /api/activities", 24, 0, 0.0, 103.33333333333334, 81, 203, 96.0, 142.5, 191.75, 203.0, 0.07332363831893339, 0.08506687726845007, 0.019906222121741684], "isController": false}, {"data": ["TX_J10", 24, 0, 0.0, 625.9583333333334, 546, 769, 601.0, 736.5, 762.0, 769.0, 0.07320800529537905, 1.854876854221509, 0.059767473073180546], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 406.2, 350, 478, 406.0, 478.0, 478.0, 478.0, 0.10540962179027702, 0.16791423346123036, 0.0325287504743433], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 81, 0, 0.0, 225.37037037037035, 196, 306, 223.0, 246.0, 262.8999999999999, 306.0, 0.2543418668693028, 0.3030244898247553, 0.07575612245618883], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 81, 0, 0.0, 225.90123456790124, 194, 357, 220.0, 260.6, 305.59999999999997, 357.0, 0.254328290725495, 0.38844672528776775, 0.07475860889489648], "isController": false}]}, function(index, item){
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
