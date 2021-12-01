/* * * * * * * * * * * * * *
*      class BarVis        *
* * * * * * * * * * * * * */


class BarVis {
    //create constructor
    constructor(parentElement, covidData, usaData, descending, title) {
        this.parentElement = parentElement
        this.covidData = covidData
        this.usaData = usaData
        this.descending = descending // boolean, true if descending

        this.title = title

        this.displayData = [];

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initVis()
    }

    initVis() {
        let vis = this;

        //use the same color scale as map

        vis.colorScale = d3.scaleSequential()
            //http://using-d3js.com/04_05_sequential_scales.html
            .interpolator(d3.interpolateReds)

        vis.margin = {top: 20, right: 80, bottom: 20, left: 70};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        // init drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append('g')
            .attr('transform', `translate (${vis.margin.left}, ${vis.margin.top})`);

        // add title
        vis.svg.append('g')
            .attr('class', 'title bar-title')
            .append('text')
            .text(vis.title)
            .attr('transform', `translate(${vis.width / 2}, 10)`)
            .attr('text-anchor', 'middle');

        // tooltip
        vis.tooltip = d3.select("body").append('div')
            .attr('class', "tooltip")
            .attr('id', 'barTooltip')


        //also set up your axis and scales before moving on to wrangleData().


        // // Scales and axes
        // vis.x = d3.scaleLinear()
        //     .range([0, vis.width]);
        // //set domain later
        //
        // vis.y = d3.scaleBand()
        //     .rangeRound([0, vis.height])
        //     .padding(0.2);
        //
        // //make y axis to show bar names
        // vis.yAxis = d3.axisLeft()
        //     .scale(vis.y)
        //
        // vis.gy = vis.svg.append("g")
        //     .attr("class", "y-axis axis")
        // // .attr("transform", "translate(100,0)")
        // //
        // vis.svgTitle = vis.svg.append("text")
        //     .attr("class", "barcharttitle")
        //     .text(vis.title)
        //     .attr("x", 10)
        //     .attr("y", 10)
        // console.log("EHERAHHR")


        // Scales and axes - set domains later
        vis.x = d3.scaleBand()
            .range([0, vis.width])
            .padding(0.1)

        vis.y = d3.scaleLinear()
            .range([vis.height, 0])

        vis.xAxis = d3.axisBottom()
            .scale(vis.x);

        vis.yAxis = d3.axisLeft()
            .scale(vis.y)
            .ticks(5)

        // Append x-axis
        vis.svg.append("g")
            .attr("class", "x-axis axis")
            .attr("transform", "translate(0," + vis.height + ")")
        // .call(vis.xAxis);

        vis.svg.append("g")
            .attr("class", "y-axis axis")

        this.wrangleData();
    }

    wrangleData() {
        let vis = this
        // Pulling this straight from dataTable.js
        let filteredData = [];

        // if there is a region selected
        if (selectedTimeRange.length !== 0) {
            //console.log('region selected', vis.selectedTimeRange, vis.selectedTimeRange[0].getTime() )

            // iterate over all rows the csv (dataFill)
            vis.covidData.forEach(row => {
                // and push rows with proper dates into filteredData
                if (selectedTimeRange[0].getTime() <= vis.parseDate(row.submission_date).getTime() && vis.parseDate(row.submission_date).getTime() <= selectedTimeRange[1].getTime()) {
                    filteredData.push(row);
                }
            });
        } else {
            filteredData = vis.covidData;
        }

        // prepare covid data by grouping all rows by state
        let covidDataByState = Array.from(d3.group(filteredData, d => d.state), ([key, value]) => ({key, value}))

        // init final data structure in which both data sets will be merged into
        vis.stateInfo = []

        // merge
        covidDataByState.forEach(state => {

            // get full state name
            let stateName = nameConverter.getFullName(state.key)

            // init counters
            let newCasesSum = 0;
            let newDeathsSum = 0;
            let population = 0;

            // look up population for the state in the census data set
            vis.usaData.forEach(row => {
                if (row.state === stateName) {
                    population += +row["2020"].replaceAll(',', '');
                }
            })

            // calculate new cases by summing up all the entries for each state
            state.value.forEach(entry => {
                newCasesSum += +entry['new_case'];
                newDeathsSum += +entry['new_death'];
            });

            // populate the final data structure
            vis.stateInfo.push(
                {
                    state: stateName,
                    population: population,
                    absCases: newCasesSum,
                    absDeaths: newDeathsSum,
                    relCases: (newCasesSum / population * 100),
                    relDeaths: (newDeathsSum / population * 100)
                }
            )
        })
        // TODO: Sort and then filter by top 10
        // maybe a boolean in the constructor could come in handy ?

        if (vis.descending) {
            vis.stateInfo.sort((a, b) => {
                return b[selectedCategory] - a[selectedCategory]
            })
        } else {
            vis.stateInfo.sort((a, b) => {
                return a[selectedCategory] - b[selectedCategory]
            })
        }

        // console.log('final data structure', vis.stateInfo);

        //filter out the population = 0 ones bc they mess it up for relcases and reldeaths
        vis.stateInfo = vis.stateInfo
            .filter(function (state) {
                return state.population > 1
            })

        console.log('final data structure for myDataTable', vis.stateInfo);


        vis.topTenData = vis.stateInfo.slice(0, 10)


        console.log('final data structure', vis.topTenData);


        vis.updateVis()

    }

    updateVis() {
        let vis = this;

        // console.log('here')

        //get currently selected element

        vis.selectedCategory = document.getElementById('categorySelector').value;

        //give domain to the color scale as usual
        vis.colorScale
            .domain([
                d3.min(vis.stateInfo, d => d[vis.selectedCategory]),
                d3.max(vis.stateInfo, d => d[vis.selectedCategory])])


        //create domain for x ten states
        vis.x.domain(vis.topTenData.map((d, i) => {
            return vis.topTenData[i].state
        }))

        vis.y.domain([0, d3.max(vis.topTenData, d => d[selectedCategory])])

        //unused function
        function colorMaker(d, selectedCat) {
            let color;
            vis.topTenData.find(({state}) => state === d.state)
            vis.topTenData.forEach(row => {
                if (row.state === d) {
                    color = vis.colorScale(row[selectedCat])
                }
            })
            return color;
        }

        //use this to make color

        function newcolorMaker(d) {
            let currentState = vis.topTenData.find(({state}) => state === d.state)
            return vis.colorScale(currentState[selectedCategory]);
        }

        function infoMaker(d, selectedCat) {
            let result;
            vis.topTenData.forEach(row => {

                if (row.state === d) {
                    // console.log(state)
                    result = row[selectedCat]
                }
            })
            return result;
        }

        vis.bars = vis.svg.selectAll("rect")
            .data(vis.topTenData)

        vis.bars
            .enter()
            .append("rect")
            .attr("class", "bar")
            .merge(vis.bars)
            .attr("fill", function(d) {return newcolorMaker(d)})
            .on('mouseover', function(event, d){
                d3.select(this)
                    .attr('stroke-width', '2px')
                    .attr('stroke', 'black')
                    .attr('fill', 'rgba(173,222,255,0.62)')

                vis.tooltip
                    .style("opacity", 1)
                    .style("left", event.pageX + 50 + "px")
                    .style("top", event.pageY + "px")
                    .html(`

                                  <div style="border: thin solid grey; border-radius: 5px; background: lightgrey; padding: 20px">
         
                         <h3>${d.state}<h3>   
                             <h3>Pop.: ${infoMaker(d.state, 'population')}</h3>
                                          <h3>Abs. cases: ${infoMaker(d.state, 'absCases')}<h3>  
             <h3>Rel. cases: ${infoMaker(d.state, 'relCases').toFixed(2)}%<h3>  
             <h3>Abs. deaths: ${infoMaker(d.state, 'absDeaths')}<h3>  
             <h3>Rel. cases: ${infoMaker(d.state, 'relDeaths').toFixed(2)}%<h3>  
     
                         </div>`);
            })

            .on('mouseout', function(event, d){
                d3.select(this)
                    .attr('stroke-width', '0px')
                    .attr("fill", function (d) {return newcolorMaker(d)})
                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0)
                    .style("top", 0)
                    .html(``);
            })
            .transition()
            .duration(800)
            .attr("x", function (d) {
                return vis.x(d.state);
            })
            .attr("y", function (d) {
                return vis.y(d[vis.selectedCategory]);
            })
            .attr("width", vis.x.bandwidth())
            .attr("height", function (d) {
                return (vis.height - vis.y(d[vis.selectedCategory]));
            })

        //

        //         .transition()
        //         .duration(800)
        //         .attr("x", function (d) {
        //             return vis.x(d.state);
        //         })
        //         .attr("y", function (d) {
        //             return vis.y(d[vis.selectedCategory]);
        //         })
        //         .attr("height", function (d) {
        //             return (vis.height - vis.y(d[vis.selectedCategory]));
        //         })
        //         .attr("width", vis.x.bandwidth())
        //         // .attr("fill", d=> vis.colorScale(d[vis.selectedCategory]))
        //         .attr("stroke-width", "4")
        //     // .attr("fill", function (d) {
        //     //     return colorMaker(d, vis.selectedCategory)
        //     // })
        //
        //     vis.bars
        //         .on('mouseover', function (event, d) {
        //             d3.select(this)
        //                 .attr('stroke-width', '2px')
        //                 .attr('stroke', 'black')
        //                 .attr('fill', 'rgba(173,222,255,0.62)')
        //
        //
        //             vis.tooltip
        //                 .style("opacity", 1)
        //                 .style("left", event.pageX + 50 + "px")
        //                 .style("top", event.pageY + "px")
        //                 .html(`
        //      <div style="border: thin solid grey; border-radius: 5px; background: lightgrey; padding: 20px">
        //          <h3>hello<h3>
        //
        //
        // </div>`);
        //         })
        //
        //         .on('mouseout', function (event, d) {
        //             d3.select(this)
        //                 .attr('stroke-width', '0px')
        //             // .attr("fill", d => vis.countryInfo[d.properties.name].color)
        //
        //             vis.tooltip
        //                 .style("opacity", 0)
        //                 .style("left", 0)
        //                 .style("top", 0)
        //                 .html(``);
        //         });



        vis
            .
            bars
            .

            exit()

            .

            remove();

        vis
            .
            svg
            .

            select(

                ".x-axis"
            )
            .

            transition()

            .

            duration(

                800
            )
            .

            call(vis

                .
                xAxis
            )

        vis
            .
            svg
            .

            select(

                ".y-axis"
            )
            .

            transition()

            .

            duration(

                800
            )
            .

            call(vis

                .
                yAxis
            )
        ;


    }





}