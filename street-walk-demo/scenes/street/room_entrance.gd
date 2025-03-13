extends Area3D

@export var target_scene: String = "res://scenes/room/room.tscn"

var player_in_area = false

func _ready():
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

func _on_body_entered(body):
	if body.is_in_group("player"):
		player_in_area = true

func _on_body_exited(body):
	if body.is_in_group("player"):
		player_in_area = false

func _process(_delta):
	if player_in_area and Input.is_action_just_pressed("interact"):
		SceneManager.goto_scene(target_scene)
