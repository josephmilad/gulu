class_name Shaders
## Spatial shaders for the city: walls with grime and panel seams, interior-mapped
## windows, snow settling on trees, additive glows, the distant skyline.

static var _cache := {}

static func get_shader(name: String) -> Shader:
	if not _cache.has(name):
		var s := Shader.new()
		s.code = CODE[name]
		_cache[name] = s
	return _cache[name]

const CODE := {
"wall": """
shader_type spatial;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rough_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec3 tint : source_color = vec3(1.0);
uniform float tex_meters = 2.0;
uniform bool seams = true;
varying vec2 meters;
void vertex() {
	meters = UV;
}
void fragment() {
	vec2 uv = meters / tex_meters;
	vec3 c = texture(albedo_tex, uv).rgb * tint;
	float hgt = meters.y;
	c *= mix(0.55, 1.0, smoothstep(0.0, 1.8, hgt));
	float col = floor(meters.x / 1.6);
	float st = fract(sin(col * 91.7) * 4375.5);
	float streak = smoothstep(0.3, 0.0, abs(fract(meters.x / 1.6) - 0.5 - (st - 0.5) * 0.4)) * st;
	c *= 1.0 - 0.18 * streak * smoothstep(2.0, 12.0, hgt);
	if (seams) {
		vec2 g = abs(fract(meters / vec2(3.2, 2.8) + 0.5) - 0.5) * vec2(3.2, 2.8);
		float seam = 1.0 - smoothstep(0.012, 0.03, min(g.x, g.y));
		c *= 1.0 - 0.5 * seam;
	}
	ALBEDO = c;
	NORMAL_MAP = texture(normal_tex, uv).rgb;
	ROUGHNESS = texture(rough_tex, uv).r;
	METALLIC = 0.0;
}
""",
"window": """
shader_type spatial;
render_mode cull_back;
uniform float t_time = 0.0;
varying vec3 pos_l;
varying vec3 cam_l;
varying float seed;
float h1(float x) { return fract(sin(x * 78.233 + 0.5) * 43758.5453); }
void vertex() {
	pos_l = VERTEX;
	cam_l = (inverse(MODEL_MATRIX) * vec4(CAMERA_POSITION_WORLD, 1.0)).xyz;
	seed = INSTANCE_CUSTOM.r;
}
void fragment() {
	vec3 o = vec3(pos_l.xy, 0.0);
	vec3 d = normalize(pos_l - cam_l);
	const float D = 1.6;
	vec3 inv = 1.0 / d;
	float tx = ((d.x > 0.0 ? 0.5 : -0.5) - o.x) * inv.x;
	float ty = ((d.y > 0.0 ? 0.5 : -0.5) - o.y) * inv.y;
	float tz = (-D - o.z) * inv.z;
	float t = min(min(tx, ty), tz);
	vec3 p = o + d * t;
	float sd = floor(seed * 997.0 + 0.5) / 997.0;
	float r1 = h1(sd), r2 = h1(sd + 0.371), r3 = h1(sd + 0.713);
	vec3 wall = mix(mix(vec3(0.62, 0.55, 0.42), vec3(0.42, 0.52, 0.45), step(0.5, r1)), vec3(0.55, 0.47, 0.52), step(0.8, r1));
	wall *= 0.9 + 0.1 * step(0.5, fract((p.x + p.z) * 9.0));
	vec3 col;
	if (t == tz) {
		col = wall;
		if (abs(p.x - (r2 - 0.5) * 0.4) < 0.22 && p.y < 0.25) col = mix(vec3(0.45, 0.12, 0.1), vec3(0.3, 0.2, 0.12), r3);
	} else if (t == ty) {
		col = d.y < 0.0 ? vec3(0.32, 0.2, 0.12) * (0.85 + 0.15 * step(0.5, fract(p.z * 6.0))) : vec3(0.85, 0.82, 0.75);
	} else {
		col = wall * 0.78;
	}
	float depth = clamp(-p.z / D, 0.0, 1.0);
	bool lit = r2 > 0.55;
	bool tv = !lit && r3 > 0.86;
	vec3 light;
	if (lit) {
		vec3 lamp_pos = vec3(0.0, 0.42, -D * 0.5);
		float lamp = 1.0 / (1.0 + 6.0 * dot(p - lamp_pos, p - lamp_pos));
		vec3 warm = mix(vec3(1.0, 0.78, 0.5), vec3(1.0, 0.9, 0.75), r3);
		light = warm * (0.9 + 2.6 * lamp) * mix(1.0, 0.65, depth);
	} else if (tv) {
		float fl = 0.6 + 0.4 * sin(t_time * 7.0 + sd * 20.0) * sin(t_time * 3.1 + sd);
		light = vec3(0.25, 0.35, 0.7) * fl * mix(0.9, 0.3, depth);
	} else {
		light = vec3(0.025, 0.03, 0.045);
	}
	col *= light;
	float cw = 0.18 + 0.12 * r1;
	if (abs(pos_l.x) > 0.5 - cw) {
		vec3 fabric = mix(vec3(0.6, 0.3, 0.2), vec3(0.75, 0.68, 0.5), r3) * (0.85 + 0.15 * sin(pos_l.x * 60.0));
		col = fabric * (lit ? vec3(1.0, 0.8, 0.55) * 0.9 : (tv ? vec3(0.15, 0.2, 0.35) : vec3(0.03)));
	}
	float fres = pow(1.0 - abs(d.z), 3.0);
	col += vec3(0.04, 0.05, 0.08) * (0.4 + fres * 2.0);
	ALBEDO = vec3(0.0);
	EMISSION = col * 1.4;
	ROUGHNESS = 0.1;
	SPECULAR = 0.5;
}
""",
"snowy": """
shader_type spatial;
render_mode cull_disabled;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_tex = true;
uniform vec3 tint : source_color = vec3(1.0);
uniform vec2 uv_rep = vec2(1.0, 1.0);
uniform float snow_amount = 0.75;
varying float up;
void vertex() {
	up = (MODEL_MATRIX * vec4(NORMAL, 0.0)).y;
}
void fragment() {
	vec3 c = tint;
	if (has_tex) {
		c *= texture(albedo_tex, UV * uv_rep).rgb;
		NORMAL_MAP = texture(normal_tex, UV * uv_rep).rgb;
	}
	float snow = smoothstep(0.25, 0.65, up) * snow_amount;
	ALBEDO = mix(c, vec3(0.93, 0.95, 0.98), snow);
	ROUGHNESS = 0.9;
}
""",
"glow": """
shader_type spatial;
render_mode blend_add, unshaded, depth_draw_never, cull_disabled, fog_disabled;
uniform vec3 color : source_color = vec3(1.0, 0.6, 0.25);
uniform float opacity = 0.9;
void fragment() {
	vec2 p = UV - 0.5;
	float r = length(p) * 2.0;
	float a = pow(max(0.0, 1.0 - r), 2.2);
	ALBEDO = color * a * opacity;
	ALPHA = a * opacity;
}
""",
"skyline": """
shader_type spatial;
uniform vec3 wall_col : source_color = vec3(0.45, 0.44, 0.41);
void fragment() {
	// Window grid lit at random, seen from far away.
	vec2 cell = floor(UV * vec2(12.0, 20.0));
	float r = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
	vec2 f = fract(UV * vec2(12.0, 20.0));
	float win = step(0.25, f.x) * step(f.x, 0.7) * step(0.3, f.y) * step(f.y, 0.75);
	ALBEDO = wall_col * 0.5;
	EMISSION = vec3(1.0, 0.85, 0.6) * win * step(0.62, r) * 1.6;
	ROUGHNESS = 0.9;
}
""",
"shopfront": """
shader_type spatial;
uniform float repeat_x = 5.0;
void fragment() {
	vec2 uv = vec2(fract(UV.x * repeat_x), UV.y);
	// Lit shop window: shelves with goods, a frame, a dark band on top.
	vec3 c = vec3(0.92, 0.88, 0.78) * (0.7 + 0.3 * uv.y);
	float shelf = step(0.92, fract(uv.y * 3.0 + 0.2));
	c = mix(c, vec3(0.3, 0.2, 0.12), shelf);
	float goods = step(0.55, fract(uv.x * 7.0)) * step(fract(uv.y * 3.0), 0.5);
	vec3 gcol = vec3(0.3 + 0.4 * fract(sin(floor(uv.x * 7.0) * 3.1) * 7.0), 0.5, 0.35);
	c = mix(c, gcol, goods * 0.8);
	float frame = step(uv.x, 0.03) + step(0.97, uv.x) + step(0.88, uv.y);
	c = mix(c, vec3(0.15, 0.17, 0.2), clamp(frame, 0.0, 1.0));
	ALBEDO = c * 0.3;
	EMISSION = c * 0.9 * (1.0 - clamp(frame, 0.0, 1.0));
	ROUGHNESS = 0.25;
	METALLIC = 0.1;
}
""",
"road": """
shader_type spatial;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rough_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform float width = 8.8;
uniform float length = 482.0;
uniform float offset = 0.0;   // world coordinate of the road's start along its length
uniform float pitch = 78.0;
uniform float crossing = 14.0;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void fragment() {
	// Metres: u across the road (0 = centre), v along it.
	float u = (UV.x - 0.5) * width;
	float v = UV.y * length;
	vec2 tuv = vec2(u, v) / 4.0;
	vec3 c = texture(albedo_tex, tuv).rgb;
	float rgh = texture(rough_tex, tuv).r * 0.72;
	// Distance along the road to the nearest crossing centre.
	float g = mod(v + offset + pitch * 0.5, pitch) - pitch * 0.5;
	float at_crossing = step(abs(g), crossing * 0.5);
	float paint = 0.0;
	// Dashed centre line and solid edge lines, not across the junction itself.
	paint += step(abs(u), 0.07) * step(0.5, fract(v / 6.0)) * (1.0 - at_crossing);
	paint += step(abs(abs(u) - width * 0.5 + 0.35), 0.06) * (1.0 - at_crossing);
	// Zebra crossing just before each junction.
	float zebra_band = step(abs(abs(g) - crossing * 0.5 - 2.0), 1.6);
	paint += zebra_band * step(0.5, fract(u / 1.0)) * step(abs(u), width * 0.5 - 0.6);
	// Stop line.
	paint += step(abs(abs(g) - crossing * 0.5 - 4.2), 0.2) * step(abs(u), width * 0.5 - 0.6);
	// Worn paint, half under the slush.
	float wear = smoothstep(0.35, 0.7, vnoise(vec2(u, v) * 1.7) * 0.6 + vnoise(vec2(u, v) * 7.0) * 0.4);
	paint = clamp(paint, 0.0, 1.0) * wear;
	c = mix(c, vec3(0.86, 0.86, 0.82), paint * 0.85);
	// Ploughed snow builds up at the kerbs and in the wheel ruts' gaps.
	float kerb = smoothstep(width * 0.5 - 1.4, width * 0.5 - 0.2, abs(u));
	float slush = kerb * (0.6 + 0.4 * vnoise(vec2(u, v) * 0.8));
	c = mix(c, vec3(0.88, 0.9, 0.94), slush * 0.75);
	ALBEDO = c;
	ROUGHNESS = mix(mix(rgh, 0.55, paint), 0.85, slush);
	NORMAL_MAP = texture(normal_tex, tuv).rgb;
}
""",
"ice": """
shader_type spatial;
void fragment() {
	float s = fract(sin(dot(floor(UV * 400.0), vec2(12.9898, 78.233))) * 43758.5453);
	vec3 c = vec3(0.86, 0.9, 0.95) + 0.05 * s;
	float scratch = step(0.995, fract(sin(UV.x * 240.0 + UV.y * 3.0) * 4.0));
	ALBEDO = mix(c, vec3(0.98), scratch);
	ROUGHNESS = 0.15;
	METALLIC = 0.1;
	SPECULAR = 0.7;
}
""",
}
