extends Node

# Dictionary to store spawn points for each scene
var scene_spawn_points = {}

# Store the last active scene path
var last_scene_path = ""

func update_scene_spawn_point(scene_path: String, spawn_point: Vector3):
	# Update the spawn point for a specific scene
	scene_spawn_points[scene_path] = spawn_point

func get_scene_spawn_point(scene_path: String) -> Vector3:
	# Retrieve the spawn point for a specific scene
	return scene_spawn_points.get(scene_path, Vector3.ZERO)

func goto_scene(path: String):
	# Store the current scene path as last active scene
	last_scene_path = get_tree().current_scene.scene_file_path if get_tree().current_scene else ""
	
	# Store the current player's position as the spawn point for the current scene
	var current_player = get_tree().get_nodes_in_group("player")[0] if get_tree().get_nodes_in_group("player") else null
	if current_player and last_scene_path:
		update_scene_spawn_point(last_scene_path, current_player.global_position)
	
	# Load the new scene
	var root = get_tree().root
	var current_scene = root.get_child(root.get_child_count() - 1)
	
	# Instantiate new scene
	var new_scene = load(path).instantiate()
	
	# Remove current scene
	current_scene.queue_free()
	
	# Add new scene
	root.add_child(new_scene)
	get_tree().current_scene = new_scene
	
	# Wait a frame to ensure scene is fully loaded
	await get_tree().process_frame
	
	# Position player at the stored spawn point for this scene
	var new_player = new_scene.get_node_or_null("Player")
	if new_player:
		var spawn_point = get_scene_spawn_point(path)
		if spawn_point != Vector3.ZERO:
			new_player.global_position = spawn_point
		else:
			print("No previous spawn point found for scene: ", path)
