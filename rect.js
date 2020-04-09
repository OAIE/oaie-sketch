function Rect(x, y, w, h) {
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	
	this.isInside = function(p) {
		return p.x >= this.x && p.x <= this.x + this.w && p.y >= this.y && p.y <= this.y + this.h;
	};
	
	this.center = function() {
		return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
	}
	
	// find the intersection point of a line going into a rect
	this.findEnd = function(p1) {
		// TODO: i guess there are better and cheaper implementations for this.
		// TODO: this is also quite unstable for small interation counts
		//       we get significantly different solutions for small difference in inputs
		var p2 = this.center();
		var p = { x: p2.x, y: p2.y };
		var s = { x: p2.x - p1.x, y: p2.y - p1.y };
		for (var i = 0; i < 15; i++) {
			s.x /= 2;
			s.y /= 2;
			var sign = this.isInside(p, this) ? -1 : 1;
			p.x += sign * s.x;
			p.y += sign * s.y;
		}
		p.error = Math.sqrt(s.x * s.x + s.y * s.y);
		return p;
	}
}
