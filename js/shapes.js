/**
 * Created by Itai Caspi on 28/07/2016.
 */

var inheritsFrom = function (child, parent) {
    child.prototype = Object.create(parent.prototype);
    child.prototype.constructor = child;
};

var Line = function(vertices, radius, color, stroke, key) {

    if (radius == undefined) {
        // copy constructor
        var shape = vertices;
        this.vertices = [];
        for (var i = 0; i < shape.vertices.length; i++) {
            this.vertices.push(new Vertex(shape.vertices[i]));
        }
        this.default_color = new Color(shape.color);
        this.color = new Color(shape.color);
        this.border_color = new Color(shape.color);
        this.stroke = shape.stroke;
        this.radius = shape.radius;
        this.points = shape.points;
        this.linkStart = shape.linkStart;
        this.linkEnd = shape.linkEnd;
        this.startDir = shape.startDir;
        this.endDir = shape.endDir;
        this.type = shape.type;
    } else {
        this.vertices = vertices;
        this.default_color = color;
        this.color = color;
        this.border_color = color;
        this.stroke = (typeof stroke != 'undefined') ? stroke : 1;
        this.radius = (typeof radius != 'undefined') ? radius : 2;
        this.points = 0;
        this.linkStart = {};
        this.linkEnd = {};
        this.startDir = [];
        this.endDir = [];
        this.type = "Line";
    }
    this.key = new Uint32Array(1);
    window.crypto.getRandomValues(this.key);
    this.key = (typeof key != 'undefined') ? key : this.key[0];
};

Line.prototype.clone = function() {
    return new Line(this);
};


Line.prototype.has_border_line = function(line_points) {
    var i;
    for (i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (vi.key == line_points.p1.key && vj.key == line_points.p2.key) {
            return true;
        }
    }
    return false;
};

Line.prototype.shapes_are_linked = function(shapes) {
	var is_start = false;
	var is_end = false;
	for (var i = 0; i < shapes.length; i++) {
	    if (Object.keys(this.linkStart).length > 0 && shapes[i].has_border_line(this.linkStart)) {
            is_start = shapes[i];
        }
        if (Object.keys(this.linkEnd).length > 0 && shapes[i].has_border_line(this.linkEnd)) {
            is_end = shapes[i];
        }
	}
	return [is_start, is_end]
};


Line.prototype.linked_shapes_moved = function(dx, dy, shapes) {

	var results = this.shapes_are_linked(shapes);
	var start_moved = results[0];
	var end_moved = results[1];

    if (start_moved && end_moved && start_moved.type != "Line" && end_moved.type != "Line") {
        this.move(dx,dy);
    }
    if (start_moved) {
        this.linkStart.p1 = start_moved.get_vertex_by_key(this.linkStart.p1.key);
        this.linkStart.p2 = start_moved.get_vertex_by_key(this.linkStart.p2.key);
        this.sync_start();
        //this.move_start(dx, dy);
    }
    if (end_moved) {
        this.linkEnd.p1 = end_moved.get_vertex_by_key(this.linkEnd.p1.key);
        this.linkEnd.p2 = end_moved.get_vertex_by_key(this.linkEnd.p2.key);
        //console.log(this.linkEnd);
        this.sync_end();
        //this.move_end(dx, dy);
    }
};

Line.prototype.linked_shape_color_change = function(shape, arrows) {
    if (shape.has_border_line(this.linkStart)) {
        this.color = shape.border_color;
        this.border_color = shape.border_color;
        this.default_color = shape.border_color;
        for (var a = 0; a < arrows.length; a++) {
            arrows[a].linked_shape_color_change(this, arrows);
        }
    }
};

Line.prototype.start_line = function(start, color, linkStart) {
    // linkStart is an array of 2 points and a type
    this.points++;
    this.vertices[0] = start;
    this.color = color;
    this.border_color = color;
    this.linkStart = linkStart;
	this.startDir = direction_of_line_between_two_points(linkStart.p1, linkStart.p2, 0);
	this.sync_start();
};

Line.prototype.add_point = function(point) {
    var lastIdx = this.points-1;
    if (this.points == 1) {
        if (this.startDir == "horizontal" || (this.startDir == true && Math.abs(point.x - this.vertices[lastIdx].x) < Math.abs(point.y - this.vertices[lastIdx].y))) {
            this.vertices[this.points] = new Vertex(this.vertices[lastIdx].x, point.y, 0);
        } else {
            this.vertices[this.points] = new Vertex(point.x, this.vertices[lastIdx].y, 0);
        }
    } else if (this.points > 1) {
        if (this.vertices[lastIdx].y == this.vertices[lastIdx-1].y) {
            this.vertices[this.points] = new Vertex(this.vertices[lastIdx].x, point.y, 0);
        } else {
            this.vertices[this.points] = new Vertex(point.x, this.vertices[lastIdx].y, 0);
        }
    }
};

Line.prototype.end_line = function(end, linkEnd) {
    var lastIdx = this.points-1;
    // close a line
    if (Math.abs(this.vertices[lastIdx].y - end.y) > 3 || Math.abs(this.vertices[lastIdx].x - end.x) > 3) {
        if (this.vertices[lastIdx].y == this.vertices[lastIdx-1].y) {
            this.vertices[lastIdx+1] = new Vertex(this.vertices[lastIdx].x, end.y, 0);
        } else {
            this.vertices[lastIdx+1] = new Vertex(end.x, this.vertices[lastIdx].y, 0);
        }
    } else if (this.points > 2) {
        this.points--;
    }
    this.points = this.vertices.length;
    lastIdx = this.points-1;
    this.endDir = direction_of_line_between_two_points(this.vertices[lastIdx], this.vertices[lastIdx-1], 0);
    this.linkEnd = linkEnd;
    this.sync_end();
};


Line.prototype.draw = function(ctx) {

    if (this.vertices.length == 0) return;
    var horizontal, vertical, over, offset;
    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (var v = 1; v < this.vertices.length; v++) {
        var last = (v == this.vertices.length - 1);
        horizontal = (this.vertices[v].y == this.vertices[v-1].y);
        vertical = (this.vertices[v].x == this.vertices[v-1].x);
        over = (horizontal && this.vertices[v].x >= this.vertices[v-1].x) || (vertical && this.vertices[v].y >= this.vertices[v-1].y);
        offset = (over ? -this.radius : this.radius);
        if (this.vertices[v].subtract(this.vertices[v-1]).norm() < this.radius) {
            offset*=0.1;
        }
        if (horizontal) {
            if (v > 1) ctx.quadraticCurveTo(this.vertices[v-1].x, this.vertices[v-1].y, this.vertices[v-1].x - offset, this.vertices[v-1].y);
            ctx.lineTo(this.vertices[v].x + (last ? 0 : offset), this.vertices[v].y);
        } else if (vertical) {
            if (v > 1) ctx.quadraticCurveTo(this.vertices[v-1].x, this.vertices[v-1].y, this.vertices[v-1].x, this.vertices[v-1].y - offset);
            ctx.lineTo(this.vertices[v].x, this.vertices[v].y + (last ? offset : offset));
        }
    }

    // draw border
    if (this.stroke > 0) {
        ctx.strokeStyle = this.border_color.to_string();
        ctx.lineWidth = this.stroke;
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(this.vertices[this.vertices.length-1].x, this.vertices[this.vertices.length-1].y);
    if (horizontal) {
        ctx.lineTo(this.vertices[this.vertices.length-1].x + offset * 2, this.vertices[this.vertices.length-1].y+5);
        ctx.lineTo(this.vertices[this.vertices.length-1].x + offset * 2, this.vertices[this.vertices.length-1].y-5);
    } else if (vertical) {
        ctx.lineTo(this.vertices[this.vertices.length-1].x+5, this.vertices[this.vertices.length-1].y + offset * 2);
        ctx.lineTo(this.vertices[this.vertices.length-1].x-5, this.vertices[this.vertices.length-1].y + offset * 2);
    }
    ctx.closePath();
    ctx.fillStyle = this.border_color.to_string();
    ctx.fill();

    if (this.linkStart.shape.type == "Line") {
        ctx.beginPath();
        ctx.arc(this.vertices[0].x, this.vertices[0].y, 5, 0, 2 * Math.PI, false);
        ctx.fillStyle = this.border_color.to_string();
        ctx.fill();
    }
};

Line.prototype.move = function(dx, dy) {
	for (var v = 0; v < this.vertices.length; v++) {
		this.vertices[v].translate(dx,dy,0);
	}
};

Line.prototype.translate = function(dx,dy) {
    this.move(dx,dy);
};

Line.prototype.move_start = function(dx, dy) {
    var startDir;
    if (this.endDir == "vertical" && this.points % 2 == 1) startDir = "horizontal";
    else if (this.endDir == "vertical" && this.points % 2 == 0) startDir = "vertical";
    else if (this.endDir == "horizontal" && this.points % 2 == 1) startDir = "vertical";
    else if (this.endDir == "horizontal" && this.points % 2 == 0) startDir = "horizontal";

    if (this.points > 2) {
        if (startDir == "vertical") this.vertices[1].translate(dx,0,0);
        if (startDir == "horizontal") this.vertices[1].translate(0,dy,0);
        this.vertices[0].translate(dx,0,0);
        this.vertices[0].translate(0,dy,0);
    } else if (this.points == 2) {
        var newVertices = this.vertices;
        var midX, midY;
        if (this.endDir == "horizontal" && dy != 0) {
            midX = (this.vertices[0].x + this.vertices[1].x) / 2;
            newVertices = [this.vertices[0], new Vertex(midX, this.vertices[0].y, 0),
                new Vertex(midX, this.vertices[1].y, 0), this.vertices[1]];
        } else if (this.endDir == "vertical" && dx != 0) {
            midY = (this.vertices[0].y + this.vertices[1].y) / 2;
            newVertices = [this.vertices[0], new Vertex(this.vertices[0].x, midY, 0),
                new Vertex(this.vertices[1].x, midY, 0), this.vertices[1]];
        }
        this.vertices = newVertices;
        this.points = this.vertices.length;
    }
};

Line.prototype.move_end = function(dx, dy) {
    var last = this.vertices.length-1;
    if (this.points > 2 || (this.endDir == "horizontal" && dy == 0) || (this.endDir == "vertical" && dx == 0)) {
        if (this.endDir == "vertical") this.vertices[last - 1].translate(dx,0,0);
        if (this.endDir == "horizontal") this.vertices[last - 1].translate(0,dy,0);
        this.vertices[last].translate(dx,0,0);
        this.vertices[last].translate(0,dy,0);
    } else if (this.points == 2) {
        var newVertices = this.vertices;
        var midX, midY;
        if (this.endDir == "horizontal" && dy != 0) {
            midX = (this.vertices[0].x + this.vertices[1].x) / 2;
            newVertices = [this.vertices[0], new Vertex(midX, this.vertices[0].y, 0),
                new Vertex(midX, this.vertices[1].y, 0), this.vertices[1]];
        } else if (this.endDir == "vertical" && dx != 0) {
            midY = (this.vertices[0].y + this.vertices[1].y) / 2;
            newVertices = [this.vertices[0], new Vertex(this.vertices[0].x, midY, 0),
                new Vertex(this.vertices[1].x, midY, 0), this.vertices[1]];
        }
        this.vertices = newVertices;
        this.points = this.vertices.length;
    }
};

Line.prototype.sync_start = function() {
    var new_x = this.linkStart.p2.x - (this.linkStart.p2.x - this.linkStart.p1.x) * this.linkStart.dist;
    var new_y = this.linkStart.p2.y - (this.linkStart.p2.y - this.linkStart.p1.y) * this.linkStart.dist;
    this.move_start(new_x - this.vertices[0].x, new_y - this.vertices[0].y);
};

Line.prototype.sync_end = function() {
    var new_x = this.linkEnd.p2.x - (this.linkEnd.p2.x - this.linkEnd.p1.x) * this.linkEnd.dist;
    var new_y = this.linkEnd.p2.y - (this.linkEnd.p2.y - this.linkEnd.p1.y) * this.linkEnd.dist;
    this.move_end(new_x - this.vertices[this.vertices.length-1].x, new_y - this.vertices[this.vertices.length-1].y);
};


Line.prototype.pointer_is_on_the_border = function(xm, ym, ctx) {
    var cursor = new Vertex(xm, ym, 0);
    // check if the pointer position is relevant by comparing the color under the cursor with the color of the line
    if (!color_under_cursor_matches_given_color(this.border_color, ctx, cursor,this.stroke)) return false;

    // go over all parts of the line and check if the pointer is on them
    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (point_is_on_line_between_two_points(cursor,vi,vj,this.stroke)) {
            return direction_of_line_between_two_points(vi,vj,this.stroke);
        }
    }
    return false;
};

Line.prototype.pointer_is_on_the_border_line = function(xm, ym, ctx) {
    var cursor = new Vertex(xm, ym, 0);
    // check if the pointer position is relevant by comparing the color under the cursor with the color of the line
    if (!color_under_cursor_matches_given_color(this.border_color, ctx, cursor,this.stroke)) return false;

    // go over all lines of the border and check if the pointer is on them
    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (point_is_on_line_between_two_points(cursor,vi,vj,this.stroke)) {
            var dist = relative_position_on_the_line_between_two_points(vi, vj, cursor);
            return {p1: vi, p2: vj, dist: dist};
        }
    }
    return false;
};

Line.prototype.pointer_is_on_end = function(xm, ym, ctx) {
    var pointer = new Vertex(xm, ym, 0);
    var dist = pointer.subtract(this.vertices[this.vertices.length-1]).norm();
    var radius = 5; //px
    return dist < radius;
};


Line.prototype.get_vertex_by_key = function(key) {
    for (var i = 0; i < this.vertices.length; i++) {
        if (this.vertices[i].key == key) {
            return this.vertices[i];
        }
    }
};

//////////////////////////////////
//  Shape

var Shape = function(x, y, width, height, radius, stroke, text, color, border_color, dashedBorder, key) {
    this.x = x;
    this.y = y;
    this.baseWidth = width;
    this.width = width;
    this.height = height;
    this.radius = (typeof radius != 'undefined') ? radius : 2;
    this.stroke = (typeof stroke != 'undefined') ? stroke : 1;
    this.textColor = "white";
    this.default_color = new Color(color);
    this.color = new Color(color);
    this.default_border_color = new Color(border_color);
    this.border_color = new Color(border_color);
    this.vertices = [];
    this.dashedBorder = (typeof dashedBorder != 'undefined') ? dashedBorder : false;
    this.update_text((typeof text != 'undefined') ? text : "");

    this.key = new Uint32Array(1);
    window.crypto.getRandomValues(this.key);
    this.key = (typeof key != 'undefined') ? key : this.key[0];

    this.set_layer(new Layer());
    this.full_details = false;
};

Shape.prototype.set_layer = function(layer) {
    this.layer = layer;
};


Shape.prototype.clone = function() {

};

Shape.prototype.has_border_line = function(line_points) {
    var i;
    for (i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (vi.key == line_points.p1.key && vj.key == line_points.p2.key) {
            return true;
        }
    }
    return false;
};

Shape.prototype.pointer_is_inside = function(xm, ym) {
    var j = this.vertices.length-1;
    var oddNodes = false;

    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[j];
        if ((vi.y < ym && vj.y >= ym || vj.y < ym && vi.y >= ym) && (vi.x <= xm || vj.x <= xm)) {
            if (vi.x + (ym - vi.y)/(vj.y-vi.y)*(vj.x - vi.x) < xm) {
                oddNodes = !oddNodes;
            }
        }
        j = i;
    }

    return oddNodes;
};


Shape.prototype.pointer_is_on_the_border = function(xm, ym, ctx) {
    var cursor = new Vertex(xm, ym, 0);
    // check if the pointer position is relevant by comparing the color under the cursor with the color of the line
    if (!color_under_cursor_matches_given_color(this.border_color, ctx, cursor,this.stroke)) return false;

    // go over all lines of the border and check if the pointer is on them
    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (point_is_on_line_between_two_points(cursor,vi,vj,this.stroke)) {
            return direction_of_line_between_two_points(vi,vj,this.stroke);
        }
    }
    return false;
};


Shape.prototype.pointer_is_on_the_border_line = function(xm, ym, ctx) {
    var cursor = new Vertex(xm, ym, 0);
    // check if the pointer position is relevant by comparing the color under the cursor with the color of the line
    if (!color_under_cursor_matches_given_color(this.border_color, ctx, cursor,this.stroke)) return false;

    // go over all lines of the border and check if the pointer is on them
    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (point_is_on_line_between_two_points(cursor,vi,vj,this.stroke)) {
            var dist = relative_position_on_the_line_between_two_points(vi, vj, cursor);
            return {p1: vi, p2: vj, dist: dist};
        }
    }
    return false;
};

Shape.prototype.update_vertices = function() {

};


Shape.prototype.translate = function(dx, dy) {
    for (var i = 0; i < this.vertices.length; i++) {
        this.vertices[i].translate(dx,dy,0);
    }
    this.x += dx;
    this.y += dy;
};

Shape.prototype.update_text = function(text) {
    var textWidth = text.length * 7;
    this.text = text;
    if (textWidth > this.baseWidth) {
        this.width = textWidth;
    } else {
        this.width = this.baseWidth;
    }
    this.update_vertices();
};

Shape.prototype.hide = function() {
    this.color.a = 0;
	this.border_color.a = 0;
};

Shape.prototype.show = function() {
    this.color.a = this.default_color.a;
	this.border_color.a = this.default_border_color.a;
};

Shape.prototype.change_color = function(color) {
    this.color = new Color(this.default_color);
	this.border_color = new Color(this.default_border_color);
};


Shape.prototype.change_fill_color = function(color) {
    this.color = new Color(color);
	this.default_color = new Color(color);
};

Shape.prototype.change_border_color = function(color) {
    this.border_color = new Color(color);
	this.default_border_color = new Color(color);
};


Shape.prototype.highlight = function() {
    this.color.a = 1;
    this.textColor = "black";
};

Shape.prototype.darken = function() {
    this.textColor = "white";
    this.color.a = 0;
};

Shape.prototype.full = function() {
    if (!this.full_details){
        this.full_details = true;
        this.height += 10;
        this.y -= 5;
        this.width += 30;
        this.x -= 15;
        this.update_vertices();
    }
};


Shape.prototype.partial = function() {
    if (this.full_details) {
        this.full_details = false;
        this.height -= 10;
        this.y += 5;
        this.width -= 30;
        this.x += 15;
        this.update_vertices();
    }
};


Shape.prototype.get_vertex_by_key = function(key) {
    for (var i = 0; i < this.vertices.length; i++) {
        if (this.vertices[i].key == key) {
            return this.vertices[i];
        }
    }
};

Shape.prototype.clone_vertices = function(shape){
    this.vertices = [];
    for (var i = 0; i < shape.vertices.length; i++) {
        this.vertices.push(new Vertex(shape.vertices[i]));
    }
};

/////////////////////////////////////
//  Rectangle

var Rectangle = function(x, y, width, height, radius, offset, stroke, text, color, border_color, dashedBorder, key) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape.x, shape.y, shape.width, shape.height, shape.radius, shape.stroke, shape.text, shape.default_color, shape.default_border_color, shape.dashedBorder, shape.key);
        this.clone_vertices(shape);
        this.offset = shape.offset;
    } else {
        Shape.call(this, x, y, width, height, radius, stroke, text, color, border_color, dashedBorder, key);
        this.offset = (typeof offset != 'undefined') ? offset : 10;
    }
    this.update_vertices();
    this.type = "Rectangle";
};

inheritsFrom(Rectangle, Shape);

Rectangle.prototype.clone = function() {
    return new Rectangle(this.x, this.y, this.width, this.height, this.radius, this.offset, this.stroke, this.text, this.default_color, this.default_border_color, this.dashedBorder);
};


Rectangle.prototype.update_vertices = function() {
    var keys = [];
    for (var i = 0; i < this.vertices.length; i++) {
        keys.push(this.vertices[i].key);
    }
    this.vertices = [
        new Vertex(this.x, this.y, 0, keys[0]),
        new Vertex(this.x + this.width, this.y, 0, keys[1]),
        new Vertex(this.x + this.width - this.offset, this.y + this.height, 0, keys[2]),
        new Vertex(this.x - this.offset, this.y + this.height, 0, keys[3])
    ];
};

Rectangle.prototype.draw = function(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.x + this.radius, this.y);
    ctx.lineTo(this.x + this.width - this.radius, this.y);
    ctx.quadraticCurveTo(this.x + this.width, this.y, this.x + this.width, this.y + this.radius);
    ctx.lineTo(this.x + this.width - this.offset, this.y + this.height - this.radius);
    ctx.quadraticCurveTo(this.x + this.width - this.offset, this.y + this.height, this.x + this.width - this.radius - this.offset, this.y + this.height);
    ctx.lineTo(this.x + this.radius - this.offset, this.y + this.height);
    ctx.quadraticCurveTo(this.x - this.offset, this.y + this.height, this.x - this.offset, this.y + this.height - this.radius);
    ctx.lineTo(this.x, this.y + this.radius);
    ctx.quadraticCurveTo(this.x, this.y, this.x + this.radius, this.y);
    ctx.closePath();

    // draw fill
    ctx.fillStyle = this.color.to_string();
    ctx.fill();
    // draw border
    if (this.stroke > 0) {
		if (this.dashedBorder) {
			ctx.setLineDash([2,3]);
		}
        ctx.strokeStyle = this.border_color.to_string();
        ctx.lineWidth = this.stroke;
        ctx.stroke();
		ctx.setLineDash([0,0]);
    }
    // draw text
    if (!this.full_details || this.layer.description == "") {
        ctx.font = "bold 14px Calibri";
        ctx.textAlign = "center";
        ctx.fillStyle = this.textColor;
        ctx.fillText(this.text, this.x + (this.width - this.offset) / 2, this.y + this.height / 2 + 3);
    } else {
        ctx.font = "bold 14px Calibri";

        ctx.textAlign = "center";
        ctx.fillStyle = this.textColor;
        ctx.fillText(this.text, this.x + (this.width - this.offset) / 2, this.y + this.height / 2 - 5);

        ctx.font = "12px Calibri";
        ctx.textAlign = "center";
        ctx.fillStyle = this.textColor;
        ctx.fillText(this.layer.description, this.x + (this.width - this.offset) / 2, this.y + this.height / 2 + 13);
    }

};

/////////////////////////////////////
//  Triangle

var Triangle = function(x, y, width, height, radius, stroke, color, border_color, key) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape.x, shape.y, shape.width, shape.height, shape.radius, shape.stroke, shape.text, shape.default_color, shape.default_border_color, shape.key);
        this.clone_vertices(shape);
    } else {
        Shape.call(this, x, y, width, height, radius, stroke, "", color, border_color, key);
        this.update_vertices();
    }
    this.type = "Triangle";
};

inheritsFrom(Triangle, Shape);


Triangle.prototype.clone = function() {
    return new Triangle(this.x, this.y, this.width, this.height, this.radius, this.stroke, this.default_color, this.default_border_color);
};

Triangle.prototype.update_vertices = function() {
    this.vertices = [
        new Vertex(this.x, this.y, 0),
        new Vertex(this.x + this.width, this.y + this.height/2, 0),
        new Vertex(this.x, this.y + this.height, 0)
    ];
};


Triangle.prototype.draw = function(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.x + this.radius, this.y);
    ctx.lineTo(this.x + this.width - this.radius, this.y + this.height/2 - this.radius);
    ctx.quadraticCurveTo(this.x + this.width, this.y + this.height/2, this.x + this.width - this.radius, this.y + this.height/2 + this.radius);
    ctx.lineTo(this.x + this.radius, this.y + this.height);
    ctx.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - this.radius);
    ctx.lineTo(this.x, this.y + this.radius);
    ctx.quadraticCurveTo(this.x, this.y, this.x + this.radius, this.y);
    ctx.closePath();

    // draw fill
    ctx.fillStyle = this.color.to_string();
    ctx.fill();
    // draw border
    if (this.stroke > 0) {
        ctx.strokeStyle = this.border_color.to_string();
        ctx.lineWidth = this.stroke;
        ctx.stroke();
    }
};

/////////////////////////////////////
//  Circle

var Circle = function(x, y, radius, stroke, text, color, border_color, key) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape.x, shape.y, shape.width, shape.height, shape.radius, shape.stroke, shape.text, shape.default_color, shape.default_border_color, shape.dashedBorder, shape.key);
    } else {
        Shape.call(this, x + radius, y + radius, radius, radius, radius, stroke, text, color, border_color, false, key);
    }
    this.vertices = [];
    this.type = "Circle";
};

inheritsFrom(Circle, Shape);

Circle.prototype.clone = function() {
    return new Circle(this.x, this.y, this.width, this.stroke, this.text, this.default_color, this.default_border_color);
};

Circle.prototype.draw = function(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
    // draw fill
    ctx.fillStyle = this.color.to_string();
    ctx.fill();
    // draw border
    if (this.stroke > 0) {
        ctx.strokeStyle = this.border_color.to_string();
        ctx.lineWidth = this.stroke;
        ctx.stroke();
    }

    // draw text
    ctx.font="14px Calibri";
    ctx.textAlign="center";
    ctx.fillStyle = this.textColor;
    ctx.fillText(this.text,this.x, this.y + 3);
};

Circle.prototype.pointer_is_inside = function(xm, ym) {
    return (Math.sqrt(Math.pow(xm-this.x, 2) + Math.pow(ym-this.y,2)) < this.radius);
};

Circle.prototype.pointer_is_on_the_border = function(xm, ym, ctx) {
    var cursor = new Vertex(xm, ym, 0);
    // check if the pointer position is relevant by comparing the color under the cursor with the color of the line
    if (!color_under_cursor_matches_given_color(this.border_color, ctx, cursor,this.stroke)) return false;

    return (Math.sqrt(Math.pow(xm-this.x, 2) + Math.pow(ym-this.y,2)) < this.radius + 3 &&
            Math.sqrt(Math.pow(xm-this.x, 2) + Math.pow(ym-this.y,2)) > this.radius - 3);
};

Circle.prototype.update_text = function(text) {
    var textWidth = text.length * 7;
    this.text = text;
    if (textWidth/2 > this.baseWidth) {
        this.radius = textWidth/2;
    } else {
        this.radius = this.baseWidth;
    }
};

