extends CharacterBody3D

const SPEED = 5.0
const JUMP_VELOCITY = 4.5
const PLAYER_NAME = "Jack"
const NPC_NAME = "NPC-Trainer"

# Reference to the UI components
@onready var dialogue_ui = $DialogueUI
@onready var panel = $DialogueUI/Panel
@onready var main_vbox = $DialogueUI/Panel/VBoxContainer
@onready var input_container = $DialogueUI/Panel/VBoxContainer/InputContainer
@onready var response_container = $DialogueUI/Panel/VBoxContainer/ResponseContainer # Reference to the VBox holding ScrollContainer and CloseButton
@onready var scroll_container = $DialogueUI/Panel/VBoxContainer/ResponseContainer/ScrollContainer # Corrected path
@onready var input_field = $DialogueUI/Panel/VBoxContainer/InputContainer/LineEdit
@onready var response_label = $DialogueUI/Panel/VBoxContainer/ResponseContainer/ScrollContainer/RichTextLabel # Corrected path
@onready var send_button = $DialogueUI/Panel/VBoxContainer/InputContainer/SendButton
@onready var close_button = $DialogueUI/Panel/VBoxContainer/ResponseContainer/CloseButton # Added reference
@onready var state_chart = $StateChart

# API Communication variables
# Use the Agent's UUID defined in godot-controller/src/index.ts
var api_url = "http://localhost:3000/api/npc/interact"
var http_request = HTTPRequest.new() # Create instance in code
var current_player = null
var player_godot_id = "player_godot_1asgd3234" # Simple unique ID for this player instance
var waiting_for_response = false

# UI Layout Constants
const DIALOGUE_WIDTH = 400
const RESPONSE_HEIGHT = 200
const INPUT_HEIGHT = 30

func _ready():
	# Initialize HTTP request node for API communication
	add_child(http_request) # Add the node to the scene tree
	http_request.request_completed.connect(self._on_request_completed)

	# Setup Dialogue UI
	_setup_dialogue_ui()

	# Setup input field enter press connection
	if input_field:
		input_field.text_submitted.connect(self._on_input_field_submitted)

func _setup_dialogue_ui():
	# Hide dialogue UI by default
	if dialogue_ui:
		dialogue_ui.visible = false

	# Configure Panel size and position (centered for example)
	if panel:
		panel.set_anchors_preset(Control.PRESET_CENTER)
		panel.custom_minimum_size = Vector2(DIALOGUE_WIDTH, RESPONSE_HEIGHT + INPUT_HEIGHT + 40) # Width, estimated total height + padding
		panel.size = panel.custom_minimum_size # Set initial size

	# Configure Main VBox
	if main_vbox:
		main_vbox.set_anchors_preset(Control.PRESET_FULL_RECT) # Fill the panel
		main_vbox.add_theme_constant_override("separation", 10) # Space between response and input

	# Configure Response Container (VBox holding Scroll and Close)
	if response_container:
		response_container.size_flags_vertical = Control.SIZE_EXPAND_FILL # Takes available space

	# Configure Scroll Container
	if scroll_container:
		scroll_container.custom_minimum_size = Vector2(0, RESPONSE_HEIGHT) # Min height, width fills parent
		scroll_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		scroll_container.size_flags_vertical = Control.SIZE_EXPAND_FILL # Allow expansion within ResponseContainer

	# Configure RichTextLabel
	if response_label:
		response_label.bbcode_enabled = true
		response_label.text = ""
		response_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		response_label.size_flags_vertical = Control.SIZE_EXPAND_FILL # Fill the ScrollContainer
		response_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	# Configure Close Button (position within ResponseContainer VBox)
	if close_button:
		close_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER # Center it perhaps
		close_button.size_flags_vertical = Control.SIZE_SHRINK_END # Place at bottom of ResponseContainer

	# Configure Input Container (HBox or VBox holding LineEdit and SendButton)
	if input_container:
		input_container.custom_minimum_size = Vector2(0, INPUT_HEIGHT) # Fixed height
		input_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL # Match width
		input_container.size_flags_vertical = Control.SIZE_SHRINK_END # Stick to bottom

	# Configure LineEdit
	if input_field:
		input_field.size_flags_horizontal = Control.SIZE_EXPAND_FILL # Take available width in InputContainer
		input_field.size_flags_vertical = Control.SIZE_EXPAND_FILL # Take available height

	# Configure Send Button
	if send_button:
		# Adjust flags based on InputContainer type (HBox vs VBox)
		send_button.size_flags_horizontal = Control.SIZE_SHRINK_END # Example if in HBox
		send_button.size_flags_vertical = Control.SIZE_EXPAND_FILL # Example if in HBox


func _physics_process(delta: float) -> void:
	# Only allow movement when not in conversation
	if state_chart.get_expression_property("dialogue_active") == true:
		velocity = Vector3.ZERO

	move_and_slide()

func _input(event):
	if event.is_action_pressed("interact"):
		var player_in_range = state_chart.get_expression_property("player_in_range")
		if player_in_range:
			state_chart.send_event("t_pressed")

func _on_input_field_submitted(new_text):
	if dialogue_ui.visible and input_container.visible and not waiting_for_response:
		_on_send_button_pressed()

func _on_detection_area_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		current_player = body
		state_chart.set_expression_property("player_in_range", true)
		state_chart.send_event("player_entered_area")

func _on_detection_area_body_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		if body == current_player:
			current_player = null
			state_chart.set_expression_property("player_in_range", false)
			state_chart.send_event("player_exited_area")
			if state_chart.get_expression_property("dialogue_active"):
				state_chart.send_event("dialogue_closed")

func _on_idle_state_entered() -> void:
	print("NPC is in idle state")

func _on_player_detected_state_entered() -> void:
	print("Player detected")

func _on_conversing_state_entered() -> void:
	print("Conversing with player - Attempting to look at player")
	if current_player:
		# Calculate the target position at the same height as the NPC
		var target_position = current_player.global_position
		target_position.y = global_position.y

		# Use look_at, specifying UP direction
		look_at(target_position, Vector3.UP)
		print("NPC looking towards: ", target_position)


func _on_closed_state_entered() -> void:
	print("Dialogue UI closed")
	if dialogue_ui:
		dialogue_ui.visible = false

	state_chart.set_expression_property("dialogue_active", false)
	waiting_for_response = false
	set_input_enabled(false)

	var player_nodes = get_tree().get_nodes_in_group("player")
	if player_nodes.size() > 0:
		player_nodes[0].set_dialogue_active(false)

	if response_label:
		response_label.text = ""

func _on_input_state_entered() -> void:
	print("Waiting for player input")
	if dialogue_ui:
		dialogue_ui.visible = true
		# Ensure containers are visible - might have been hidden if UI was complex before
		input_container.visible = true
		response_container.visible = true
		scroll_container.visible = true

	set_input_enabled(true)
	waiting_for_response = false

	if input_field:
		input_field.clear()
		input_field.grab_focus()

	state_chart.set_expression_property("dialogue_active", true)

	var player_nodes = get_tree().get_nodes_in_group("player")
	if player_nodes.size() > 0:
		player_nodes[0].set_dialogue_active(true)

func _on_displaying_npc_state_entered() -> void:
	print("Displaying NPC response / Waiting for API")
	if dialogue_ui:
		dialogue_ui.visible = true
		input_container.visible = true
		response_container.visible = true
		scroll_container.visible = true

	set_input_enabled(false)

func set_input_enabled(enabled: bool):
	if input_field:
		input_field.editable = enabled
		input_field.set_context_menu_enabled(enabled)
	if send_button:
		send_button.disabled = not enabled
	if enabled:
		if input_field: input_field.modulate = Color(1,1,1)
		if send_button: send_button.modulate = Color(1,1,1)
	else:
		if input_field: input_field.modulate = Color(0.7,0.7,0.7)
		if send_button: send_button.modulate = Color(0.7,0.7,0.7)

func _on_send_button_pressed() -> void:
	var message = input_field.text
	if message.strip_edges() != "" and not waiting_for_response:
		print("Sending message: ", message)
		append_dialogue("[b]" + PLAYER_NAME + ":[/b] " + message)
		set_input_enabled(false)
		waiting_for_response = true
		state_chart.send_event("message_sent")
		send_api_request(message)
	elif waiting_for_response:
		print("Waiting for previous response.")
	else:
		print("Cannot send empty message.")
		input_field.grab_focus()

func _on_close_button_pressed() -> void:
	print("Dialogue closed by player")
	waiting_for_response = false
	http_request.cancel_request()
	state_chart.send_event("close_button_pressed")


func send_api_request(message: String) -> void:
	var headers = ["Content-Type: application/json", "Accept: application/json"]
	var body_data = {
		"playerId": player_godot_id,
		"dialogue": message
	}
	var body_json = JSON.stringify(body_data)

	print("Sending API Request:")
	print("  URL: ", api_url)
	print("  Headers: ", headers)
	print("  Body: ", body_json)

	var error = http_request.request(api_url, headers, HTTPClient.METHOD_POST, body_json)

	if error != OK:
		print("Error sending HTTP request: ", error)
		append_dialogue("[color=red]System: Error connecting to NPC. Please try again.[/color]")
		waiting_for_response = false
		set_input_enabled(true)
		state_chart.send_event("npc_response_shown")

func _on_request_completed(result, response_code, _headers, body_bytes):
	waiting_for_response = false
	print("API Response Received:")
	print("  Result: ", result)
	print("  Code: ", response_code)

	if result != HTTPRequest.RESULT_SUCCESS:
		print("API Request Failed. Result code: ", result)
		append_dialogue("[color=red]System: Network error communicating with NPC.[/color]")
	elif response_code != 200:
		print("API Request Error. Status Code: ", response_code)
		print("  Response Body: ", body_bytes.get_string_from_utf8())
		append_dialogue("[color=red]System: NPC encountered an error (Code: " + str(response_code) + ").[/color]")
	else:
		var body_string = body_bytes.get_string_from_utf8()
		print("  Response Body: ", body_string)
		var json = JSON.new()
		var error = json.parse(body_string)

		if error != OK:
			print("JSON Parse Error: ", json.get_error_message(), " at line ", json.get_error_line())
			append_dialogue("[color=red]System: Received invalid response from NPC.[/color]")
		else:
			var response_data = json.get_data()
			if typeof(response_data) == TYPE_DICTIONARY and response_data.has("success"):
				if response_data["success"] and response_data.has("data"):
					var data = response_data["data"]
					if data.has("npcDialogue"):
						var npc_text = data["npcDialogue"]
						append_dialogue("[b]" + NPC_NAME + ":[/b] " + npc_text)
					else:
						append_dialogue("[color=orange]System: NPC response missing dialogue.[/color]")
					if data.has("signals") and typeof(data["signals"]) == TYPE_ARRAY:
						handle_signals(data["signals"])
				elif not response_data["success"] and response_data.has("error"):
					var err_msg = response_data["error"].get("message", "Unknown error")
					append_dialogue("[color=red]System: NPC Error: " + err_msg + "[/color]")
				else:
					append_dialogue("[color=red]System: Received unexpected success/error format.[/color]")
			else:
				append_dialogue("[color=red]System: Received unexpected response format.[/color]")

	set_input_enabled(true)
	state_chart.send_event("npc_response_shown")

func append_dialogue(text: String):
	if response_label:
		response_label.append_text(text + "\n")
		await get_tree().create_timer(0.01).timeout
		if scroll_container:
			scroll_container.scroll_vertical = int(scroll_container.get_v_scroll_bar().max_value)


func handle_signals(signals: Array):
	if signals.is_empty():
		return

	print("Received Signals: ", signals)
	for signal_data in signals:
		if typeof(signal_data) == TYPE_DICTIONARY and signal_data.has("type"):
			match signal_data["type"]:
				"CHAPTER_COMPLETE":
					var chapter_num = signal_data.get("chapter", -1)
					print("Signal: CHAPTER_COMPLETE - Chapter ", chapter_num)
					# Find player node to call increment_level
					var player_nodes = get_tree().get_nodes_in_group("player")
					if player_nodes.size() > 0 and player_nodes[0].has_method("increment_level"):
						player_nodes[0].increment_level()
						append_dialogue("[color=yellow]System: Chapter " + str(chapter_num) + " completed! Level Up![/color]")
					else:
						print("Error: Could not find player or player.increment_level() method.")
				"SYLLABUS_COMPLETE":
					var syllabus_name = signal_data.get("syllabusName", "Unknown")
					print("Signal: SYLLABUS_COMPLETE - Syllabus: ", syllabus_name)
					append_dialogue("[color=green]System: Syllabus '" + syllabus_name + "' completed! Congratulations![/color]")
				"PLAY_ANIMATION":
					var anim_name = signal_data.get("animationName", "")
					print("Signal: PLAY_ANIMATION - Animation: ", anim_name)
				"SET_NPC_GAME_STATE":
					var game_state = signal_data.get("gameState", "")
					print("Signal: SET_NPC_GAME_STATE - State: ", game_state)
				_:
					print("Signal: Unhandled type - ", signal_data["type"])
		else:
			print("Warning: Invalid signal format received: ", signal_data)
