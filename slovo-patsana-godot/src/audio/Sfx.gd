class_name Sfx
## Sound effects. Streams are generated offline (tools/gen_audio.py) into assets/audio;
## any missing file simply stays silent, so the game runs before the audio exists.

static var _players: Array[AudioStreamPlayer] = []
static var _streams := {}
static var _music: AudioStreamPlayer
static var _wind: AudioStreamPlayer
static var _engine: AudioStreamPlayer
static var _siren: AudioStreamPlayer
static var _root: Node

static func _ensure() -> void:
	if _root:
		return
	_root = Node.new()
	_root.name = "Sfx"
	Engine.get_main_loop().root.add_child.call_deferred(_root)
	for i in range(12):
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		_root.add_child(p)
		_players.append(p)

static func _stream(name: String) -> AudioStream:
	if not _streams.has(name):
		var path := "res://assets/audio/%s.wav" % name
		_streams[name] = load(path) if ResourceLoader.exists(path) else null
	return _streams[name]

static func play(name: String, volume_db := 0.0, pitch := 1.0) -> void:
	_ensure()
	var s := _stream(name)
	if s == null:
		return
	for p in _players:
		if not p.playing:
			p.stream = s
			p.volume_db = volume_db
			p.pitch_scale = pitch
			p.play()
			return

static func _att(dist: float) -> float:
	return -clampf(dist, 0, 40) * 0.9

static func whoosh(dist := 0.0) -> void:
	play("whoosh", -8 + _att(dist), 0.9 + randf() * 0.2)
static func hit(strength := 1.0, dist := 0.0) -> void:
	play("hit", -4 + _att(dist) + strength * 3, 0.9 + randf() * 0.2)
static func block(dist := 0.0) -> void:
	play("block", -6 + _att(dist))
static func thud(dist := 0.0) -> void:
	play("thud", -4 + _att(dist))
static func step(dist := 0.0) -> void:
	play("step", -16 + _att(dist), 0.9 + randf() * 0.2)
static func coin() -> void:
	play("coin", -6)
static func ui() -> void:
	play("ui", -10)
static func confirm() -> void:
	play("confirm", -6)
static func ko() -> void:
	play("ko", -2)
static func crash(strength := 1.0, dist := 0.0) -> void:
	play("crash", -6 + _att(dist) + strength * 2)
static func horn(dist := 0.0) -> void:
	play("horn", -8 + _att(dist))

static func _loop(name: String) -> AudioStreamPlayer:
	_ensure()
	var p := AudioStreamPlayer.new()
	p.stream = _stream(name)
	_root.add_child(p)
	return p

static func start_wind() -> void:
	if _wind == null:
		_wind = _loop("wind")
		if _wind.stream:
			_wind.volume_db = -14
			_wind.play()

static func start_music() -> void:
	if _music == null:
		_music = _loop("music")
	if _music.stream and not _music.playing:
		_music.volume_db = -10
		_music.play()

static func stop_music() -> void:
	if _music:
		_music.stop()

static func engine_set(on: bool, rpm := 0.0) -> void:
	if _engine == null:
		_engine = _loop("engine")
	if _engine.stream == null:
		return
	if on and not _engine.playing:
		_engine.play()
	if not on and _engine.playing:
		_engine.stop()
	_engine.pitch_scale = 0.7 + rpm * 0.9
	_engine.volume_db = -14 + rpm * 6

static func siren(volume: float) -> void:
	if _siren == null:
		_siren = _loop("siren")
	if _siren.stream == null:
		return
	if volume <= 0.001:
		if _siren.playing:
			_siren.stop()
		return
	if not _siren.playing:
		_siren.play()
	_siren.volume_db = linear_to_db(clampf(volume, 0.001, 1))
