/* * * * * * * * * * * * * *
*          MapVis          *
* * * * * * * * * * * * * */


class MapVis {


    // constructor method to initialize Timeline object
    constructor(parentElement, geoData, covidData, usaData) {
        this.parentElement = parentElement;
        this.geoData = geoData;
        this.covidData = covidData;
        this.usaData = usaData;
        this.displayData = [];

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initVis();
    }

    initVis() {
        //pulled from LAB 8
        let vis = this;


        vis.margin = {top: 20, right: 20, bottom: 20, left: 40};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        // init drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width)
            .attr("height", vis.height)
            .attr('transform', `translate (${vis.margin.left}, ${vis.margin.top})`);

        // add title
        vis.svg.append('g')
            .attr('class', 'title')
            .attr('id', 'map-title')
            .append('text')
            .text('Impact by geography')
            .attr('transform', `translate(${vis.width / 2}, 20)`)
            .attr('text-anchor', 'middle');


        // vis.projection = d3.geoOrthographic() // d3.geoStereographic()
        //     .scale(230)
        //     .translate([vis.width / 2, vis.height / 2])

        vis.path = d3.geoPath()
        // .projection(vis.projection);

        vis.world = topojson.feature(vis.geoData, vis.geoData.objects.states).features

        vis.viewpoint = {'width': 975, 'height': 610};
        vis.zoom = vis.width / vis.viewpoint.width;

        // adjust map position
        vis.map = vis.svg.append("g") // group will contain all state paths
            .attr("class", "states")
            .attr('transform', `scale(${vis.zoom} ${vis.zoom})`);


        vis.states = vis.svg.selectAll(".state")
            .data(vis.world)
            .enter()
            .append("path")
            .attr('class', 'state')
            .attr("fill", "transparent")
            .attr("d", vis.path)

        vis.legend = vis.svg.append("g")
            .attr('class', 'legend')
            .attr('transform', `translate(${vis.width * 2.8 / 4}, ${vis.height - 20})`)


        vis.tooltip = d3.select("body").append('div')
            .attr('class', "tooltip")
            .attr('id', 'mapTooltip')

        vis.colorScale = d3.scaleSequential()
            //http://using-d3js.com/04_05_sequential_scales.html
            .interpolator(d3.interpolateReds)


        vis.wrangleData()

    }

    wrangleData() {
        //pulled from dataTable with ONE ADDITION:

        //filtered at the end for population 0
        let vis = this;

        // check out the data
        // console.log(vis.covidData)
        // console.log(vis.usaData)

        // first, filter according to selectedTimeRange, init empty array
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

        // have a look
        // console.log(covidDataByState)

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

        //filter out the population = 0 ones bc they mess it up for relcases and reldeaths
        vis.stateInfo = vis.stateInfo
            .filter(function(state) { return state.population > 1 })

        console.log('final data structure for myDataTable', vis.stateInfo);


        vis.updateVis()

    }

    updateVis() {
        let vis = this;

        vis.selectedCategory = document.getElementById('categorySelector').value;

        vis.colorScale
            .domain([
                d3.min(vis.stateInfo, d=>d[vis.selectedCategory]),
                d3.max(vis.stateInfo, d=>d[vis.selectedCategory])])

        //make legend http://using-d3js.com/04_08_legends.html
        d3.select("#legendary").remove();

        var legend = d3.legendColor()
            .scale(vis.colorScale);

        vis.svg.append("g")
            .attr("id", "legendary")
            .attr("transform", `translate(${vis.width *7/10}, ${vis.height *1/50})`)
            .call(legend);


        //helper function for creating the color fill attribute later
        function colorMaker(d, selectedCat) {
            let color;
            vis.stateInfo.forEach(row => {
                if (row.state === d.properties.name) {
                    color = vis.colorScale(row[selectedCat])
                }
            })
            return color;
        }
        //helper function for creating the html tooltip info later
        function infoMaker(d, selectedCat) {
            let result;
            vis.stateInfo.forEach(row => {
                if (row.state === d.properties.name) {
                    result = row[selectedCat]
                }
            })
            return result;
        }


        // pulled from LAB 8 and modified
        vis.states
            .attr("fill", function(d) {
                return colorMaker(d, vis.selectedCategory)})
            .on('mouseover', function(event, d) {
                // console.log(infoMaker(d, vis.selectedCategory))
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
             <h3>${d.properties.name}<h3>   
             <h3>Pop.: ${infoMaker(d, 'population')}<h3>   
             <h3>Abs. cases: ${infoMaker(d, 'absCases')}<h3>  
             <h3>Rel. cases: ${infoMaker(d, 'relCases').toFixed(2)}%<h3>  
             <h3>Abs. deaths: ${infoMaker(d, 'absDeaths')}<h3>  
             <h3>Rel. cases: ${infoMaker(d, 'relDeaths').toFixed(2)}%<h3>  
             
             
    </div>`);
            })

            .on('mouseout', function(event, d){
                d3.select(this)
                    .attr('stroke-width', '0px')
                    .attr("fill", function(d) {
                        return colorMaker(d, vis.selectedCategory)})
                // .attr("fill", d => vis.countryInfo[d.properties.name].color)

                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0)
                    .style("top", 0)
                    .html(``);
            });
    }
}

