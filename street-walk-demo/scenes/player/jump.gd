extends LimboState

@export var animated_sprite_3d : AnimatedSprite3D
@export var animation : StringName

func _enter() -> void:
	animated_sprite_3d.play(animation)
	agent.velocity.y = agent.JUMP_VELOCITY	

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	pass # Replace with function body.

func _update(delta):
	agent.apply_movement(delta)

	if agent.velocity.y < 0 and !agent.is_on_floor():
		get_root().dispatch("to_fall")
