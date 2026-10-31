class_name Tint
## Re-tints dark, unsaturated texels (clothing) without touching skin, for crowd variety.

const SHADER := """
shader_type spatial;
render_mode cull_back;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic;
uniform bool has_normal = false;
uniform float roughness_v : hint_range(0.0, 1.0) = 0.8;
uniform vec3 tint : source_color = vec3(0.2, 0.3, 0.6);
uniform float amount : hint_range(0.0, 1.0) = 0.75;
void fragment() {
	vec4 c = texture(albedo_tex, UV);
	float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	float skin = smoothstep(0.03, 0.09, c.r - c.b) * smoothstep(0.08, 0.2, l);
	float cloth = (1.0 - skin) * (1.0 - smoothstep(0.55, 0.8, l));
	ALBEDO = mix(c.rgb, tint * (0.35 + l * 2.2), cloth * amount);
	ROUGHNESS = roughness_v;
	METALLIC = 0.0;
	if (has_normal) {
		NORMAL_MAP = texture(normal_tex, UV).rgb;
	}
}
"""
static var _shader: Shader

static func make(src: StandardMaterial3D, color: Color, amount: float) -> ShaderMaterial:
	if _shader == null:
		_shader = Shader.new()
		_shader.code = SHADER
	var m := ShaderMaterial.new()
	m.shader = _shader
	if src.albedo_texture:
		m.set_shader_parameter("albedo_tex", src.albedo_texture)
	if src.normal_enabled and src.normal_texture:
		m.set_shader_parameter("normal_tex", src.normal_texture)
		m.set_shader_parameter("has_normal", true)
	m.set_shader_parameter("roughness_v", src.roughness)
	m.set_shader_parameter("tint", Vector3(color.r, color.g, color.b))
	m.set_shader_parameter("amount", amount)
	return m
