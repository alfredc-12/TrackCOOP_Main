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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.7594644506001846, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.35, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.8409090909090909, 500, 1500, "TX_J09"], "isController": true}, {"data": [0.9736842105263158, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [0.8913043478260869, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.3680555555555556, 500, 1500, "TX_J03"], "isController": true}, {"data": [0.9736842105263158, 500, 1500, "TX_J02"], "isController": true}, {"data": [0.9090909090909091, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.9166666666666666, 500, 1500, "TX_J01"], "isController": true}, {"data": [0.9130434782608695, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.6056338028169014, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.9285714285714286, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.8809523809523809, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [0.9318181818181818, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [0.8863636363636364, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.9166666666666666, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.3680555555555556, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [0.8913043478260869, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [0.9130434782608695, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [0.9761904761904762, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.42857142857142855, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.9, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.9285714285714286, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.8943661971830986, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 627, 0, 0.0, 705.5279106858058, 39, 12781, 242.0, 1785.000000000001, 2163.0, 11074.040000000074, 1.7257704037256825, 12.40570310607708, 0.4841606764152969], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 10, 0, 0.0, 2418.8, 1014, 12461, 1368.0, 11381.300000000005, 12461.0, 12461.0, 0.030363020270352332, 1.8061549352812223, 0.008687856385950423], "isController": false}, {"data": ["TX_J09", 22, 0, 0.0, 618.0454545454547, 259, 3615, 320.5, 2067.499999999999, 3447.899999999998, 3615.0, 0.06542984433645216, 1.8550383210701944, 0.03546246445969819], "isController": true}, {"data": ["J02 01 /api/auth/me", 95, 0, 0.0, 107.0, 39, 1523, 52.0, 141.60000000000002, 415.79999999999615, 1523.0, 0.2748103085685854, 0.36411235908739836, 0.07380159653941504], "isController": false}, {"data": ["TX_J04", 23, 0, 0.0, 423.0434782608695, 119, 3054, 148.0, 1935.2000000000016, 2927.199999999998, 3054.0, 0.0666790361110467, 0.6766880305332004, 0.018948827644838465], "isController": true}, {"data": ["TX_J03", 72, 0, 0.0, 2247.638888888889, 942, 12781, 1253.5, 6505.6000000000095, 11905.849999999999, 12781.0, 0.21782274069412846, 0.6298565773391742, 0.061262645820223637], "isController": true}, {"data": ["TX_J02", 95, 0, 0.0, 107.0, 39, 1523, 52.0, 141.60000000000002, 415.79999999999615, 1523.0, 0.27480712878619135, 0.3641081460064739, 0.07380074259394788], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 22, 0, 0.0, 517.0909090909091, 123, 5733, 148.5, 1698.7999999999986, 5215.349999999993, 5733.0, 0.06588305757280827, 0.4750786104664221, 0.01827225424870854], "isController": false}, {"data": ["TX_J01", 96, 0, 0.0, 344.5104166666665, 151, 2268, 204.5, 734.4999999999998, 1244.3999999999953, 2268.0, 0.26688833225373293, 2.9055382109029444, 0.07349854462456318], "isController": true}, {"data": ["TX_J08", 23, 0, 0.0, 494.60869565217394, 0, 5733, 147.0, 1504.4000000000028, 5042.79999999999, 5733.0, 0.06787123351540529, 0.4681363001915149, 0.018005242315058265], "isController": true}, {"data": ["TX_J07", 10, 0, 0.0, 5929.7, 3047, 24730, 3453.5, 22975.600000000006, 24730.0, 24730.0, 0.029862245461685245, 3.2263473285235214, 0.017176623610285754], "isController": true}, {"data": ["TX_J06", 23, 0, 0.0, 2380.3478260869565, 1996, 4974, 2062.0, 4201.600000000001, 4911.199999999999, 4974.0, 0.06604204293881348, 0.8699620285172414, 0.03727763751819746], "isController": true}, {"data": ["TX_J05", 71, 0, 0.0, 916.9718309859156, 414, 7965, 563.0, 1888.9999999999989, 3665.9999999999964, 7965.0, 0.21582843159606643, 0.5831618675239008, 0.12682117113522717], "isController": true}, {"data": ["J10 01 /api/documents", 21, 0, 0.0, 351.38095238095235, 206, 1055, 274.0, 792.2000000000002, 1032.1999999999996, 1055.0, 0.06763524633722934, 0.7781072759421429, 0.018295862534582548], "isController": false}, {"data": ["J10 02 /api/announcements", 21, 0, 0.0, 506.85714285714283, 257, 1761, 361.0, 1380.0000000000005, 1732.9999999999995, 1761.0, 0.06765093406611107, 0.847448754417445, 0.018564367649001184], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 23, 0, 0.0, 2072.608695652174, 1850, 4265, 1910.0, 2671.000000000001, 3987.799999999996, 4265.0, 0.06609100443959139, 0.08629264935130243, 0.01891080498125027], "isController": false}, {"data": ["J09 01 /api/inventory", 22, 0, 0.0, 267.6363636363637, 125, 1805, 159.5, 603.9999999999998, 1644.1999999999978, 1805.0, 0.06577373834011002, 0.5086545253079406, 0.017792310078330542], "isController": false}, {"data": ["J09 02 /api/pos/orders", 22, 0, 0.0, 350.40909090909093, 125, 1810, 148.5, 1515.6999999999994, 1803.6999999999998, 1810.0, 0.065458656907376, 1.3496373274271773, 0.017771002558838407], "isController": false}, {"data": ["J01 01 /api/public/landing", 96, 0, 0.0, 344.5104166666665, 151, 2268, 204.5, 734.4999999999998, 1244.3999999999953, 2268.0, 0.26689278416436146, 2.9055866776018573, 0.07349977063901361], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 10, 0, 0.0, 3510.9, 1922, 12269, 2182.0, 11594.300000000003, 12269.0, 12269.0, 0.02995375140782632, 1.454424290770051, 0.008658506266324794], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 72, 0, 0.0, 2247.638888888889, 942, 12781, 1253.5, 6505.6000000000095, 11905.849999999999, 12781.0, 0.2178168100123127, 0.6298394281703691, 0.061260977815962944], "isController": false}, {"data": ["J04 01 /api/membership-applications", 23, 0, 0.0, 423.0434782608695, 119, 3054, 148.0, 1935.2000000000016, 2927.199999999998, 3054.0, 0.06667826288629906, 0.6766801835101757, 0.018948607910071316], "isController": false}, {"data": ["J06 01 /api/financial-records", 23, 0, 0.0, 307.7391304347826, 128, 1781, 155.0, 1075.6000000000008, 1688.7999999999988, 1781.0, 0.06646207904941889, 0.7887179537192757, 0.018497746610433966], "isController": false}, {"data": ["J10 03 /api/activities", 21, 0, 0.0, 153.66666666666669, 78, 578, 107.0, 377.80000000000007, 560.7999999999997, 578.0, 0.06770196948253128, 0.07854486303246794, 0.01838002687123408], "isController": false}, {"data": ["TX_J10", 21, 0, 0.0, 1011.9047619047617, 576, 3081, 749.0, 2715.8000000000006, 3061.4999999999995, 3081.0, 0.06755148388092926, 1.7017168732348154, 0.05514945363716489], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 439.0, 366, 585, 425.0, 585.0, 585.0, 585.0, 0.10631737863871228, 0.1693602617533862, 0.032808878564290114], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 70, 0, 0.0, 458.05714285714294, 210, 5899, 280.5, 911.3, 1265.9500000000007, 5899.0, 0.21644218520030178, 0.25787057221129706, 0.06446764305282426], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 71, 0, 0.0, 465.36619718309845, 198, 3701, 271.0, 1066.1999999999991, 2074.0, 3701.0, 0.21582646336421782, 0.32964119990394203, 0.06344117721936479], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 627, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
