extends CharacterBody3D

const SPEED = 5.0
const JUMP_VELOCITY = 4.5

# Reference to the UI components
@onready var dialogue_ui = $DialogueUI
@onready var input_container = $DialogueUI/Panel/VBoxContainer/InputContainer
@onready var response_container = $DialogueUI/Panel/VBoxContainer/ResponseContainer
@onready var input_field = $DialogueUI/Panel/VBoxContainer/InputContainer/LineEdit
@onready var response_label = $DialogueUI/Panel/VBoxContainer/ResponseContainer/RichTextLabel
@onready var loading_label = $DialogueUI/Panel/VBoxContainer/ResponseContainer/LoadingLabel
@onready var state_chart = $StateChart

# API Communication variables
var api_url = "http://localhost:3000/a34d47d1-1bef-0e10-9aa6-199cf903b81b/message"
var http_request = null
var current_player = null
var waiting_for_response = false
var loading_dots = ""
var loading_timer = 0.0

func _ready():
	# Initialize HTTP request node for API communication
	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.request_completed.connect(Callable(self, "_on_request_completed"))
	
	# Hide dialogue UI by default
	if dialogue_ui:
		dialogue_ui.visible = false
		
	# Set up the UI layout
	_setup_dialogue_ui()
	
	# Hide loading indicator initially
	if loading_label:
		loading_label.visible = false

func _setup_dialogue_ui():
	# Adjust the main panel size and position
	var panel = dialogue_ui.get_node("Panel")
	panel.anchor_right = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_left = 50
	panel.offset_top = 50
	panel.offset_right = -50
	panel.offset_bottom = -50
	
	# Set up VBoxContainer to take full width
	var vbox = panel.get_node("VBoxContainer")
	vbox.anchor_right = 1.0
	vbox.anchor_bottom = 1.0
	vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	
	# Configure response container to take necessary space
	response_container.custom_minimum_size = Vector2(0, 200)  # Minimum height
	response_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	response_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	
	# Configure response label
	response_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	response_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	response_label.scroll_following = true
	response_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	
	# Create loading indicator if it doesn't exist
	if not response_container.has_node("LoadingLabel"):
		loading_label = Label.new()
		loading_label.name = "LoadingLabel"
		loading_label.text = "..."
		loading_label.visible = false
		response_container.add_child(loading_label)
	
	# Configure input container
	input_container.size_flags_vertical = Control.SIZE_SHRINK_END
	input_container.custom_minimum_size = Vector2(0, 50)  # Set minimum height
	
	# Configure input field
	input_field.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	input_field.placeholder_text = "Type your message here..."
	
	# Position the dialogue UI to take more screen space
	dialogue_ui.anchor_top = 0.2
	dialogue_ui.anchor_right = 1.0
	dialogue_ui.anchor_bottom = 0.8

func _physics_process(delta: float) -> void:
	# Only allow movement when not in conversation
	if state_chart.get_expression_property("dialogue_active") == true:
		velocity = Vector3.ZERO
	
	move_and_slide()
	
	# Handle loading animation
	if waiting_for_response:
		loading_timer += delta
		if loading_timer >= 0.5:
			loading_timer = 0.0
			loading_dots += "."
			if loading_dots.length() > 3:
				loading_dots = "."
			if loading_label:
				loading_label.text = loading_dots

func _input(event):
	# Check for interact key press (T key)
	if event.is_action_pressed("interact"):
		var player_in_range = state_chart.get_expression_property("player_in_range")
		if player_in_range:
			state_chart.send_event("t_pressed")
	
	# Allow Enter key to send messages
	if event is InputEventKey and event.pressed and event.keycode == KEY_ENTER:
		if dialogue_ui.visible and input_container.visible and not waiting_for_response:
			_on_send_button_pressed()

# Detection area signals
func _on_detection_area_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		current_player = body
		state_chart.set_expression_property("player_in_range", true)
		state_chart.send_event("player_entered_area")

func _on_detection_area_body_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		current_player = null
		state_chart.set_expression_property("player_in_range", false)
		state_chart.send_event("player_exited_area")

# State entry signals
func _on_idle_state_entered() -> void:
	print("NPC is in idle state")
	# No animation changes needed as per your request

func _on_player_detected_state_entered() -> void:
	print("Player detected")
	# You could add visual indicator above NPC's head if needed


func _on_conversing_state_entered() -> void:
	print("Conversing with player")
	# Face towards player with only Y-axis rotation
	if current_player:
		# Calculate direction to player on X-Z plane
		var direction_to_player = current_player.global_position - global_position
		direction_to_player.y = 0  # Ignore vertical difference
		
		# Normalize the direction vector
		direction_to_player = direction_to_player.normalized()
		
		# Use dot product with world forward vector to determine rotation
		var world_forward = Vector3.FORWARD
		var dot_product = direction_to_player.dot(world_forward)
		
		# Determine rotation based on the sign of the x component
		var rotation_y = 0 if direction_to_player.x >= 0 else PI
		
		# Set rotation to either 0 or 180 degrees
		global_rotation = Vector3(0, rotation_y, 0)
		
		print("Player direction: ", direction_to_player)
		print("Dot product: ", dot_product)
		print("Rotation Y: ", rotation_y)

func _on_closed_state_entered() -> void:
	print("Dialogue UI closed")
	if dialogue_ui:
		dialogue_ui.visible = false
	
	# Disable dialogue active state
	state_chart.set_expression_property("dialogue_active", false)
	
	# Clear dialogue when conversation ends
	response_label.text = ""
	waiting_for_response = false
	if loading_label:
		loading_label.visible = false
	
	# Re-enable player movement
	var player = get_tree().get_nodes_in_group("player")[0]
	player.set_dialogue_active(false)

func _on_input_state_entered() -> void:
	print("Waiting for player input")
	if dialogue_ui:
		dialogue_ui.visible = true
		input_container.visible = true
		response_container.visible = true  # Keep response visible during input
	
	# Hide loading indicator
	if loading_label:
		loading_label.visible = false
		
	waiting_for_response = false
		
	# Focus on input field automatically
	if input_field:
		input_field.clear()
		input_field.grab_focus()
	
	# Set dialogue active state
	state_chart.set_expression_property("dialogue_active", true)
	
	# Disable player movement
	var player = get_tree().get_nodes_in_group("player")[0]
	player.set_dialogue_active(true)

func _on_displaying_npc_state_entered() -> void:
	print("Displaying NPC response")
	if dialogue_ui:
		dialogue_ui.visible = true
		input_container.visible = false  # Hide input while showing response
		response_container.visible = true

# UI Button signals
func _on_send_button_pressed() -> void:
	var message = input_field.text
	if message.strip_edges() != "" and not waiting_for_response:
		print("Sending message: ", message)
		
		# Display player message
		response_label.text = "You: " + message
		
		# Show loading indicator
		waiting_for_response = true
		loading_dots = "."
		loading_timer = 0.0
		if loading_label:
			loading_label.visible = true
		
		state_chart.send_event("message_sent")
		send_api_request(message)
	else:
		print("Cannot send empty message or already waiting for response")

func _on_close_button_pressed() -> void:
	print("Dialogue closed by player")
	state_chart.send_event("close_button_pressed")
	state_chart.send_event("dialogue_closed")

# API Communication
func send_api_request(message: String) -> void:
	# Build multipart/form-data body manually
	var boundary = "---------------------------GodotBoundary"
	var body = ""
	body += "--" + boundary + "\r\n"
	body += "Content-Disposition: form-data; name=\"text\"\r\n\r\n"
	body += message + "\r\n"
	body += "--" + boundary + "\r\n"
	body += "Content-Disposition: form-data; name=\"user\"\r\n\r\n"
	body += "user1\r\n"
	body += "--" + boundary + "\r\n"
	body += "Content-Disposition: form-data; name=\"roomId\"\r\n\r\n"
	body += "default-room1\r\n"
	body += "--" + boundary + "--\r\n"
	
	# Set request headers
	var headers = []
	headers.append("Accept: application/json")
	headers.append("Content-Type: multipart/form-data; boundary=" + boundary)
	
	# Send the request with body as a String
	var error = http_request.request(api_url, headers, HTTPClient.METHOD_POST, body)
	
	if error != OK:
		print("Error sending HTTP request: ", error)
		# Show error message and return to input state
		response_label.text = "System: Error connecting to NPC. Please try again."
		waiting_for_response = false
		if loading_label:
			loading_label.visible = false
		state_chart.send_event("npc_response_shown")

func _on_request_completed(result, response_code, headers, body):
	waiting_for_response = false
	if loading_label:
		loading_label.visible = false
		
	if result != HTTPRequest.RESULT_SUCCESS or response_code != 200:
		print("Error with API request. Result: ", result, ", Response code: ", response_code)
		response_label.text = "System: Failed to get a response. Please try again."
	else:
		# Parse the JSON response
		var json = JSON.new()
		var error = json.parse(body.get_string_from_utf8())
		if error == OK:
			var response_data = json.get_data()
			if response_data.size() > 0 and response_data[0].has("text"):
				var npc_text = response_data[0]["text"]
				response_label.text = "NPC: " + npc_text
			else:
				response_label.text = "System: Received invalid response format."
		else:
			response_label.text = "System: Failed to parse response."
	
	# Regardless of success or failure, transition back to input state
	state_chart.send_event("npc_response_shown")
