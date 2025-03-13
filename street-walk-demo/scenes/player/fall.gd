extends LimboState

@export var animated_sprite_3d : AnimatedSprite3D
@export var animation : StringName

func _enter() -> void:
	animated_sprite_3d.play(animation)

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _update(delta: float) -> void:
	if agent.is_on_floor() and agent.movement_input == Vector2.ZERO:
		get_root().dispatch('to_idle')
	elif agent.is_on_floor() and agent.movement_input != Vector2.ZERO:
		get_root().dispatch("to_move")
