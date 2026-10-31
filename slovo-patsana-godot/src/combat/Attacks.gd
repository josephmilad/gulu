class_name Attacks
## Damage, range, timing and knockback for every move (port of combat/attacks.ts).
## hits: [{t, dmg, range, arc, kb, knockdown?, unblockable?, until?}]
## move: [from, to, speed] forward movement during the attack.

const PUNCH_CHAIN := ["jab", "cross", "hook"]

## Seconds into each clip where the hand or foot is furthest forward (measured once
## from the retargeted clips; every character shares the same clips).
const IMPACT := {"jab": 0.202, "cross": 0.3, "hook": 0.272, "haymaker": 0.378, "kick": 0.711, "lunge": 0.22}

static func _a(id: String, clip: String, dur: float, hits: Array, stamina: float, chain_at: float, kind: String, move = null) -> Dictionary:
	return {"id": id, "clip": clip, "dur": dur, "hits": hits, "stamina": stamina, "chain_at": chain_at, "kind": kind, "move": move}

static var ALL: Dictionary = {
	"jab": _a("jab", "jab", 0.32, [{"t": 0.1, "dmg": 6, "range": 1.3, "arc": 0.9, "kb": 1.2}], 6, 0.14, "punch", [0, 0.12, 2]),
	"cross": _a("cross", "cross", 0.4, [{"t": 0.13, "dmg": 9, "range": 1.35, "arc": 0.9, "kb": 2}], 8, 0.18, "punch", [0, 0.14, 2.5]),
	"hook": _a("hook", "hook", 0.5, [{"t": 0.21, "dmg": 13, "range": 1.25, "arc": 1.2, "kb": 4.5, "knockdown": true}], 12, 0.3, "punch", [0.05, 0.22, 2.5]),
	"kick": _a("kick", "kick", 0.6, [{"t": 0.25, "dmg": 13, "range": 1.7, "arc": 0.7, "kb": 5}], 14, 0.4, "kick"),
	"flurry": _a("flurry", "flurry", 1.05, [
		{"t": 0.11, "dmg": 5, "range": 1.35, "arc": 0.9, "kb": 0.8},
		{"t": 0.27, "dmg": 5, "range": 1.35, "arc": 0.9, "kb": 0.8},
		{"t": 0.43, "dmg": 5, "range": 1.35, "arc": 0.9, "kb": 0.8},
		{"t": 0.59, "dmg": 5, "range": 1.35, "arc": 0.9, "kb": 0.8},
		{"t": 0.84, "dmg": 16, "range": 1.45, "arc": 1.0, "kb": 7, "knockdown": true},
	], 40, 1, "special", [0, 0.85, 1.6]),
	"lunge": _a("lunge", "lunge", 0.7, [{"t": 0.2, "until": 0.5, "dmg": 17, "range": 1.3, "arc": 1.1, "kb": 7, "knockdown": true}], 35, 0.65, "special", [0.12, 0.48, 11]),
	"haymaker": _a("haymaker", "haymaker", 0.95, [{"t": 0.52, "dmg": 30, "range": 1.5, "arc": 1.2, "kb": 8, "knockdown": true, "unblockable": true}], 35, 0.9, "special", [0.4, 0.55, 3]),
	"sweep": _a("sweep", "roll", 0.6, [{"t": 0.14, "until": 0.42, "dmg": 11, "range": 1.25, "arc": 1.2, "kb": 5, "knockdown": true}], 28, 0.55, "special", [0, 0.45, 8.5]),
	"turbokick": _a("turbokick", "kick", 0.72, [{"t": 0.25, "dmg": 22, "range": 1.9, "arc": 0.8, "kb": 9, "knockdown": true}], 32, 0.65, "special", [0, 0.22, 5]),
	"uppercut": _a("uppercut", "hook", 0.55, [{"t": 0.21, "dmg": 21, "range": 1.3, "arc": 1.0, "kb": 6, "knockdown": true}], 30, 0.5, "special", [0.02, 0.2, 3.5]),
}

static func get_attack(id: String) -> Dictionary:
	return ALL.get(id, {})
