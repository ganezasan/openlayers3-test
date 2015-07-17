(function($) {
  var map,
      pointsVector,
      arcsVector,
      color = d3.scale.category10(),
      maxZoom = 5,
      minZoom = 2,
      zoom = 3;

  var init = function(targetId) {
    var projection = ol.proj.get('EPSG:3857');
    map = new ol.Map({
      target: targetId,
      layers: [
        new ol.layer.Tile({
          source: new ol.source.XYZ({
            url: 'http://api.tiles.mapbox.com/v4/bpurcell.map-im7uxt8h/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFuYWdlciIsImEiOiJmNWFhMWZlZjY0OTA2MTFkOTE1Mzg3MzJkZDlhY2FjMyJ9.PhwEUFo5M4zWREzE3Gvgow',
          }),
          extent: projection.getExtent(),
        })
      ],
      view: new ol.View({
        center: [0, 0],
        projection: projection,
        extent: projection.getExtent(),
        zoom: zoom,
        minZoom: minZoom,
        maxZoom: maxZoom
      })
    });

    // create vector source to hold point data
    pointsVector = new ol.source.Vector({wrapX: false});
    // create a vector map layer used for showing points
    var points_map_layer = createVectorLayer('Points', pointsVector);
    //Add the vector layer to the map
    map.addLayer(points_map_layer);

    arcsVector = new ol.source.Vector({wrapX: false});
    var arcs_map_layer = createVectorLayer('Arcs', arcsVector);
    map.addLayer(arcs_map_layer);

    return map;
  };

  var updateMap = function(data){
    clearVector();
    var inport = data.import;
    plotPoint([inport.lon, inport.lat], inport.country, pointsVector,getPointStyle(color(inport.country)));
    var exports = data.exports;

    // Draw the arc
    exports.forEach(function(d){
      plotPoint([d.lon, d.lat], d.country, pointsVector,getPointStyle(color(d.country)));
      var export_point = projectCoord([d.lon, d.lat]);
      var import_point = projectCoord([inport.lon, inport.lat]);
      var arcFeatures = createArcBetweenPoints(import_point,export_point,arcsVector,d.country);
      arcFeatures.forEach(function(d){
        arcsVector.addFeature(d);
      });
    });
    setCenterMap(inport.lon, inport.lat, 3);
  };

  var setCenterMap = function(lon, lat, zoom){
    var view = map.getView();
    view.setCenter(ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'));
    view.setZoom(zoom);
  };

  function clearVector(){
    map.getLayers().forEach(function (lyr) {
      if(["Points","Arcs"].indexOf(lyr.get("name")) !== -1){
        var vector = lyr.get("source");
        vector.clear();
      }
    });
  }

  // Map Functions
  function createVectorLayer(layer_name, source) {
    // create a vector layer used for editing
    var vector_layer = new ol.layer.Vector({
      name: layer_name.toString(),
      source: source,
    });
    return vector_layer;
  }

  function addFeature(point, name, layer) {
    var feature = new ol.Feature({
      geometry: point,
      name: name
    });
    layer.addFeature(feature);
  }

  function projectCoord(coordinate) {
    var coord = ol.proj.transform(coordinate, 'EPSG:4326', 'EPSG:3857');
    var point = new ol.geom.Point(coord);
    return point;
  }

  function getArcApex(start, end) {
    var generator = new arc.GreatCircle(start, end, {
      'name': ''
    });
    var line = generator.Arc(100, {
      offset: 10
    });
    var coordinates = line.geometries[0].coords;
    var apex = getMidCoord(coordinates);
    return apex;
  }

  function getMidCoord(coordinates) {
    var middleIndex = coordinates.length/2 - 1;
    var apex = coordinates[Math.floor(middleIndex)];
    return apex;
  }

  function createArcBetweenPoints(pointA, pointB, layer, name) {
    var transformedA = pointA.transform('EPSG:3857', 'EPSG:4326');
    var transformedB = pointB.transform('EPSG:3857', 'EPSG:4326');

    var start = {
      x: transformedA.getCoordinates()[0],
      y: transformedA.getCoordinates()[1]
    };
    var end = {
      x: transformedB.getCoordinates()[0],
      y: transformedB.getCoordinates()[1]
    };
    var generator = new arc.GreatCircle(start, end, {
      'name': ''
    });
    var line = generator.Arc(100, {
      offset: 10
    });

    var features = [];

    // if(line.geometries > 2){
    line.geometries.forEach(function(d){
      var coordinates = d.coords;
      var start_coordinate = getCoordinate(coordinates[0]);
      var end_coordinate = getCoordinate(coordinates[coordinates.length-1]);

      var apex = getArcApex(start_coordinate, end_coordinate);
      var apexFeature = plotApex(apex, 'apex');
      var apexGeom = apexFeature.getGeometry();
      var lineString = new ol.geom.LineString(coordinates);
      var geom = lineString.transform('EPSG:4326', 'EPSG:3857');
      var feature = new ol.Feature({
        'geometry': geom,
        'name' : name,
        'lat' : '08088982912918',
        'lon' : '08088982912918',
        'price' : '10000'
      });

      //Adds an arrow
      var dx = end_coordinate.x - start_coordinate.x;
      var dy = end_coordinate.y - start_coordinate.y;
      var rotation = Math.atan2(dy, dx);
      var imgsrc = getArrowImage(color(name));
      var lineStyles = getLineStyles(color(name),apexGeom,imgsrc,rotation);

      feature.setStyle(lineStyles);
      features.push(feature);
    });

    return features;
  }

  function getLineStyles(color,apexGeom,imgsrc,rotation){
    return [
      // linestring
      new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: color,
          width: 2
        })
      }),
      // arrow
      new ol.style.Style({
        geometry: apexGeom,
        image: new ol.style.Icon({
          src: imgsrc,
          anchor: [0.75, 0.5],
          rotateWithView: false,
          rotation: -rotation
        })
      })
    ];
  }

  function getArrowImage(color){
    var svg = d3.select("canvas").append("svg")
      .attr("viewBox","-10 0 10 10")
      .attr("width","20")
      .attr("height","20")
      .data([{color:color}]);

    svg.append("svg:polygon")
      .attr("points","0,10 5 , 8 10 , 10 5 , 0 0 ,10")
      .attr("transform","rotate(90)")
      .style("fill", function(d){return d.color;});
    console.warn(svg);

    var svgData = new XMLSerializer().serializeToString(svg.node());
    var imgsrc = "data:image/svg+xml;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(svgData)));
    d3.selectAll("svg").remove();
    return imgsrc;
  }

  function getCoordinate(coord){
    return {
      x : coord[0],
      y : coord[1]
    };
  }

  function plotApex(coord, name) {
    var point = projectCoord(coord);
    var feature = new ol.Feature({
      geometry: point,
      name: name
    });
    return feature;
  }

  function plotPoint(coord, name, layer, style) {
    var point = projectCoord(coord);
    var feature = new ol.Feature({
      geometry: point,
      name: name,
      lon: coord[0],
      lat: coord[1],
    });
    feature.setStyle(style);
    layer.addFeature(feature);
    return feature;
  }

  function getPointStyle(color){
    // var scale = [1.0,0.75,0.1,2.0];
    return new ol.style.Style({
      image: new ol.style.Circle({
        // radius: scale[Math.floor( Math.random() * 4)]*10,
        radius: 5,
        fill: new ol.style.Fill({
          color: color,
        }),
        stroke: new ol.style.Stroke({
          color: color,
          width: 5
        })
      })
    });
  }

  $.sourceMap = {
    init: init,
    updateMap: updateMap,
    setCenterMap: setCenterMap
  };
}(jQuery));