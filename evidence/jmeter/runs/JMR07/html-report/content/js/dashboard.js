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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.757221803566943, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.25, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.8506493506493507, 500, 1500, "TX_J09"], "isController": true}, {"data": [0.9717514124293786, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [0.9, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.30656934306569344, 500, 1500, "TX_J03"], "isController": true}, {"data": [0.9717514124293786, 500, 1500, "TX_J02"], "isController": true}, {"data": [0.930379746835443, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.9361111111111111, 500, 1500, "TX_J01"], "isController": true}, {"data": [0.930379746835443, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.014705882352941176, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.6361940298507462, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.8766233766233766, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.8040540540540541, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [0.9415584415584416, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [0.9415584415584416, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.9350282485875706, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.30656934306569344, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [0.9, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [0.91875, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [0.9726027397260274, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.4391891891891892, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.4, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.9307116104868914, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.9291044776119403, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 2301, 0, 0.0, 907.9139504563236, 40, 45882, 258.0, 1935.800000000001, 2736.5000000000014, 9012.820000000002, 6.347288540951182, 44.17098887776297, 1.7848570291186345], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 34, 0, 0.0, 3162.941176470588, 1172, 45882, 1547.5, 2873.0, 18162.75, 45882.0, 0.1010941960038059, 6.013623790214677, 0.028972825359776404], "isController": false}, {"data": ["TX_J09", 77, 0, 0.0, 942.2597402597404, 257, 15726, 362.0, 657.0, 6049.899999999976, 15726.0, 0.22795902658535142, 6.462994589673753, 0.12376595435638582], "isController": true}, {"data": ["J02 01 /api/auth/me", 354, 0, 0.0, 133.86440677966104, 40, 4814, 57.0, 146.0, 279.25, 2201.899999999994, 1.000022599380777, 1.326008735720016, 0.2690931883700761], "isController": false}, {"data": ["TX_J04", 80, 0, 0.0, 684.2500000000002, 126, 10207, 190.0, 933.4000000000026, 3960.400000000002, 10207.0, 0.23183500302834473, 2.352763038545467, 0.06599033936297538], "isController": true}, {"data": ["TX_J03", 274, 0, 0.0, 2965.64233576642, 987, 45121, 1293.0, 2412.5, 9706.75, 44406.25, 0.7824167539984637, 2.263301977172848, 0.2204869464544242], "isController": true}, {"data": ["TX_J02", 354, 0, 0.0, 133.86440677966104, 40, 4814, 57.0, 146.0, 279.25, 2201.899999999994, 1.0000367245124822, 1.3260274653447726, 0.26909698926090503], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 79, 0, 0.0, 474.3924050632914, 95, 8326, 207.0, 374.0, 2221.0, 8326.0, 0.22991650247524034, 1.6579135295675531, 0.06387390571386163], "isController": false}, {"data": ["TX_J01", 360, 0, 0.0, 462.336111111111, 0, 6653, 228.0, 467.90000000000003, 736.7999999999993, 6246.109999999995, 0.9985687181706222, 10.689951174150384, 0.2709359856774734], "isController": true}, {"data": ["TX_J08", 79, 0, 0.0, 474.3924050632914, 95, 8326, 207.0, 374.0, 2221.0, 8326.0, 0.22991583334303442, 1.6579087044970373, 0.06387371981990897], "isController": true}, {"data": ["TX_J07", 34, 0, 0.0, 6525.5, 1230, 50156, 4488.0, 10340.5, 24971.0, 50156.0, 0.10109509777977324, 10.778042344536553, 0.057382850480350384], "isController": true}, {"data": ["TX_J06", 80, 0, 0.0, 3027.2374999999997, 1999, 16720, 2351.0, 3196.9, 8640.000000000002, 16720.0, 0.23147612323788802, 3.049200611675656, 0.13087216948103053], "isController": true}, {"data": ["TX_J05", 268, 0, 0.0, 896.8134328358207, 238, 18105, 586.0, 974.9, 1323.8999999999994, 14730.46000000001, 0.7809062591967738, 2.120476689729626, 0.46212934725123916], "isController": true}, {"data": ["J10 01 /api/documents", 77, 0, 0.0, 868.9610389610388, 211, 15015, 291.0, 671.8000000000003, 7700.099999999995, 15015.0, 0.22804679401747371, 2.623556197245669, 0.06179545202132386], "isController": false}, {"data": ["J10 02 /api/announcements", 74, 0, 0.0, 886.9864864864869, 258, 11736, 362.0, 818.5, 6109.25, 11736.0, 0.2207643817553155, 2.754832180846303, 0.06068281919844629], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 80, 0, 0.0, 2484.649999999999, 1854, 11492, 2057.5, 3054.7000000000003, 5206.400000000003, 11492.0, 0.2316463686536134, 0.30245233875964955, 0.06638908011779218], "isController": false}, {"data": ["J09 01 /api/inventory", 77, 0, 0.0, 503.23376623376635, 128, 7456, 171.0, 365.4, 4387.199999999997, 7456.0, 0.2280650311145864, 1.7637177552699312, 0.0618003938564612], "isController": false}, {"data": ["J09 02 /api/pos/orders", 77, 0, 0.0, 439.0259740259739, 124, 8270, 166.0, 373.20000000000005, 2123.999999999996, 8270.0, 0.22812246324858237, 4.703466373600898, 0.06203873249086029], "isController": false}, {"data": ["J01 01 /api/public/landing", 354, 0, 0.0, 470.1694915254241, 163, 6653, 229.0, 469.5, 768.25, 6267.049999999996, 0.9992350488750139, 10.878390942244778, 0.2757119770246506], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 33, 0, 0.0, 3464.424242424242, 2133, 14810, 2945.0, 5352.200000000001, 8663.999999999975, 14810.0, 0.10184870837319836, 4.94533166896855, 0.029488866084380113], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 274, 0, 0.0, 2965.64233576642, 987, 45121, 1293.0, 2412.5, 9706.75, 44406.25, 0.7824167539984637, 2.263301977172848, 0.2204869464544242], "isController": false}, {"data": ["J04 01 /api/membership-applications", 80, 0, 0.0, 684.2500000000002, 126, 10207, 190.0, 933.4000000000026, 3960.400000000002, 10207.0, 0.23182761298698287, 2.352688041172584, 0.06598823583533285], "isController": false}, {"data": ["J06 01 /api/financial-records", 80, 0, 0.0, 542.5750000000004, 132, 6311, 185.0, 417.3000000000002, 3840.4000000000015, 6311.0, 0.23302554542541729, 2.765357839853194, 0.06496383552765722], "isController": false}, {"data": ["J10 03 /api/activities", 73, 0, 0.0, 249.7534246575342, 79, 4511, 113.0, 245.40000000000015, 383.6, 4511.0, 0.22050183801874568, 0.25581658551393543, 0.05996604592630406], "isController": false}, {"data": ["TX_J10", 74, 0, 0.0, 2027.135135135135, 551, 24767, 848.5, 1630.0, 12898.5, 24767.0, 0.22055645798250453, 5.542249415078313, 0.17956013050832303], "isController": true}, {"data": ["SETUP login", 20, 0, 0.0, 2137.8, 386, 8843, 783.5, 6423.800000000003, 8729.149999999998, 8843.0, 0.3197953309881676, 0.5097674988007675, 0.0988586054924848], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 267, 0, 0.0, 445.1273408239701, 205, 11319, 280.0, 529.8000000000001, 575.8, 7102.399999999991, 0.7823052514071239, 0.9320433659342688, 0.2334428994078506], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 268, 0, 0.0, 453.34701492537323, 204, 10001, 279.0, 540.1, 740.3999999999999, 6643.860000000001, 0.7808835055841912, 1.1935368687008487, 0.2299667095594127], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 2301, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
