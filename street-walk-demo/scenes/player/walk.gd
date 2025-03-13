extends LimboState

@export var animated_sprite_3d : AnimatedSprite3D
@export var animation : StringName

func _enter() -> void:
	animated_sprite_3d.play(animation)

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	pass # Replace with function body.

func _update(delta) -> void:
	agent.apply_movement(delta)
	agent.update_sprite_direction()
	agent.check_jump_input()
	
	if agent.movement_input == Vector2.ZERO:
		get_root().dispatch("to_idle")
