/*global Raphael:true */
var impact = function (data) {
    'use strict';
    var COL_WIDTH = 100,
        COL_SEP = 50,
        UNIT_HEIGHT = 10,
        PATH_SEP = 3,
        colLblAttr = {font: '9px "Arial"', stroke: 'none', fill: '#aaa'},
        pathLblAttr = {font: '9px "Arial"', stroke: 'none', fill: '#fff'},
        handleAttr = {fill: 'r#fff-#ddd', stroke: '#ccc'},
        paper = new Raphael('chart', 1000, 500),
        legendColour = document.getElementById('legend-colour'),
        legendText = document.getElementById('legend-text'),
        paths = {},
        labels = {},
        handles = {},
        currentDragging = null,
        mouseOver = null;


    function Bar(column, id, value) {
        this.column = column;
        this.id = String(id);
        this.value = value;
    }

    Bar.prototype.getCoords = function() {
        var column = this.column,
            value = this.value,
            numPrevious = data.columns[column].bars.indexOf(this),
            previousValues = data.columns[column].bars.slice(0, numPrevious)
                                .reduce(function(acc, x) {
                                    return acc + x.value;
                                }, 0);
            
        var topLeft     = [column * (COL_WIDTH + COL_SEP), 
                           previousValues * UNIT_HEIGHT + numPrevious * PATH_SEP + 20],
            topRight    = [topLeft[0] + COL_WIDTH,
                           topLeft[1]],
            bottomLeft  = [topLeft[0],
                           topLeft[1] + value * UNIT_HEIGHT],
            bottomRight = [topRight[0],
                           bottomLeft[1]],
            center      = [topLeft[0] + (COL_WIDTH / 2),
                           topLeft[1] + (value /2) * UNIT_HEIGHT],
            bottom      = [center[0],
                           bottomLeft[1]];
        return [topLeft, topRight, bottomLeft, bottomRight, center, bottom];
    };

    Bar.prototype.toJSON = function() {
        return {
            id: this.id,
            value: this.value
        };
    };

    function applyMouseEvents(lbl) {
        var mouseover = function (){
            mouseOver = lbl;
        },
        mouseout = function () {
            if (currentDragging === null){
                mouseOver = null;
                setTimeout(function(){
                    if(mouseOver !== lbl){
                        handles[lbl].hide();
                    }
                },20);
            }
        };

        paths[lbl].mouseover(function () {
            if (currentDragging === null){
                mouseOver = lbl;
                paths[lbl].toFront();
                labels[lbl].toFront();
                handles[lbl].show().toFront();
                legendText.innerHTML = data.labels[lbl];
                legendColour.style.backgroundColor = paths[lbl].attr('fill');
            }
        }).mouseout(mouseout);
        labels[lbl].mouseover(mouseover).mouseout(mouseout);
        handles[lbl].mouseover(mouseover).mouseout(mouseout);
    }

    function findSeries(id){
        var series = [],
            filterFunc = function(bar) {return bar.id === id;};
        for (var nCols = data.columns.length, col = 0; col < nCols; col++) {
            var bars = data.columns[col].bars.filter(filterFunc);
            if (bars.length > 1){
                throw 'Duplicate data series in column ' + col;
            }
            if(bars.length > 0) {
                series.push(bars[0]);
            }
        }
        return series;
    }

    function handleDragMove(dx, dy){
        /*jshint validthis:true */
        if(Math.abs(dy - Math.round(dy / UNIT_HEIGHT) * UNIT_HEIGHT) < 5){
            this.valueDiff = Math.max(this.data('origValue') * -1, Math.round(dy / UNIT_HEIGHT));
            this.attr({cy: this.oy + this.valueDiff * UNIT_HEIGHT});
            changeVal(this.data('col'), this.data('id'), this.data('origValue') + this.valueDiff);
            this.toFront();
        }
    }

    function handleDragStart(){
        /*jshint validthis:true */
        this.oy = this.attr('cy');
        currentDragging = this.data('id');
        handles[this.data('id')].exclude(this);
        handles[this.data('id')].hide();
    }

    function handleDragEnd(){
        /*jshint validthis:true */
        this.data('origValue', this.data('origValue') + this.valueDiff);
        this.valueDiff = 0;
        handles[this.data('id')].push(this);
        handles[this.data('id')].show().toFront();
        currentDragging = null;
    }

    function setHandle(id, col, origValue, x, y){
        if (currentDragging !== id){
            handles[id].push(paper.circle(x, y, 5)
                                .attr(handleAttr)
                                .data({
                                    id: id, 
                                    col:col, 
                                    origValue:origValue
                                    })
                                .drag(handleDragMove, 
                                        handleDragStart, 
                                        handleDragEnd));
        }
    }


    function drawSeries(id) {
        var series = findSeries(id);
        if(series.length < 1){
            return;
        }
        var path = [],
        prevPos = [],
        nBlocks = series.length,
        block;
        
        if (labels.hasOwnProperty(id)){
            labels[id].remove();
        }

        labels[id] = paper.set();
       
        if (currentDragging !== id){
            if (handles.hasOwnProperty(id)){
                handles[id].remove();
            }
            handles[id] = paper.set();
        }

        for (var j = 0; j < nBlocks; j++) {
            block = series[j].getCoords();
            if(j===0){
                path.push('M' + block[0].join());
            }else{
                path.push('C' + 
                        [prevPos[0] + (COL_SEP / 2), prevPos[1]].join() + ',' +
                        [block[0][0] - (COL_SEP / 2), block[0][1]].join() + ',' +
                        block[0].join());
            }
            path.push('L' + block[1].join());
            prevPos = block[1];

            if(series[j].value > 0){
                labels[id].push(paper.text(block[4][0], block[4][1], series[j].value).attr(pathLblAttr));
            }
            setHandle(id, j, series[j].value, block[5][0], block[5][1]);
        }
        
        path.push('L' + block[3].join());
        path.push('L' + block[2].join());
        prevPos = block[2];

        for (j = nBlocks - 2; j >= 0; j--) {
            block = series[j].getCoords();
            path.push('C' + 
                    [prevPos[0] - (COL_SEP / 2), prevPos[1]].join() + ',' +
                    [block[3][0] + (COL_SEP / 2), block[3][1]].join() + ',' +
                    block[3].join());
            path.push('L' + block[2].join());
            prevPos = block[2];
        }

        path.push('Z');
        path = path.join('');

        var clr;
        
        if(paths.hasOwnProperty(id)) {
            clr = paths[id].attrs.fill;
            paths[id].remove();
        }else{
            clr = Raphael.getColor();
        }
        paths[id] = paper.path().attr({fill: clr, stroke: clr});
        paths[id].attr({path: path});
        labels[id].toFront();
        handles[id].hide();
        if(currentDragging !== null){
            paths[currentDragging].toFront();
            labels[currentDragging].toFront();
        }
        applyMouseEvents(id);
    }

    function changeVal(col, id, newVal) {
        var bar = data.columns[col].bars.filter(function(b){return b.id === id;});
        if(bar.length !== 1){
            return;
        }
        bar = bar[0];
        bar.value = newVal;

        var barIdx = data.columns[col].bars.indexOf(bar),
            afterBars = data.columns[col].bars.slice(barIdx);

        afterBars.map(function(bar) {drawSeries(bar.id);});
    }


    // Init column labels and wrap data in classes
    for (var nCols = data.columns.length, col = 0; col < nCols; col++) {
        var lbl = data.columns[col].label,
            column = data.columns[col];
        paper.text(col * (COL_WIDTH + COL_SEP) + (COL_WIDTH / 2), 10, lbl).attr(colLblAttr);
        for (var nBars = column.bars.length, b = 0; b < nBars; b++) {
            var bar = column.bars[b];
            column.bars[b] = new Bar(col, bar.id, bar.value);
        }
    }

    // Draw all series
    for (var l in data.labels) {
        if (data.labels.hasOwnProperty(l)) {
            drawSeries(l);
        }
    }

};
