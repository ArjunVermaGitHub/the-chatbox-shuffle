# scenes/ui/global_ui.gd
extends Control

@onready var time_label = $CanvasLayer/MarginContainer/VBoxContainer/TimeLabel
@onready var level_label = $CanvasLayer/MarginContainer/VBoxContainer/LevelLabel
@onready var tint_rect = $CanvasLayer/TintRect # Added reference for tint overlay

var player_node = null

func _ready():
	# Ensure TintRect covers the whole screen and is behind other UI if needed
	if tint_rect:
		tint_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
		tint_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE # Allow clicks to pass through
		# Optional: Move TintRect to be the first child of CanvasLayer so it's drawn first (behind labels)
		# $CanvasLayer.move_child(tint_rect, 0)

	# Wait a frame for autoloads and scene tree to be fully ready
	await get_tree().process_frame

	# Connect to GameManager signals
	if GameManager:
		GameManager.time_updated.connect(_on_time_updated)
		GameManager.tint_updated.connect(_on_tint_updated)
		# Set initial time display
		_on_time_updated(GameManager.get_formatted_time_string(), GameManager.get_current_day_name())
		# Set initial tint
		_on_tint_updated(GameManager.calculate_tint_color())
	else:
		print("Error: GameManager autoload not found.")

	# Find player and connect to level signal
	var player_nodes = get_tree().get_nodes_in_group("player")
	if player_nodes.size() > 0:
		player_node = player_nodes[0]
		if player_node.has_signal("level_updated"):
			player_node.level_updated.connect(_on_level_updated)
			# Set initial level display
			_on_level_updated(player_node.player_level)
		else:
			print("Error: Player node does not have 'level_updated' signal.")
	else:
		print("Warning: Player node not found on ready. Level UI might not update.")
		level_label.text = "Level: N/A"


func _on_time_updated(time_string: String, day_string: String):
	if time_label:
		time_label.text = "Time: %s (%s)" % [time_string, day_string]

func _on_level_updated(new_level: int):
	if level_label:
		level_label.text = "Level: %d" % new_level

func _on_tint_updated(tint_color: Color):
	if tint_rect:
		# Smoothly transition the color instead of instantly setting it
		var tween = get_tree().create_tween()
		tween.tween_property(tint_rect, "color", tint_color, 0.5).set_trans(Tween.TRANS_SINE)
		# tint_rect.color = tint_color # Instant update
