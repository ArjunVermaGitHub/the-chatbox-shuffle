
# Player.gd
extends CharacterBody3D

#State Machine
@export var state_machine : LimboHSM

#States
@onready var idle_state = $LimboHSM/Idle
@onready var move_state = $LimboHSM/Move
@onready var jump_state = $LimboHSM/Jump
@onready var fall_state = $LimboHSM/Fall

@onready var animated_sprite_3D: AnimatedSprite3D = $AnimatedSprite3D

const SPEED = 2.0	
const JUMP_VELOCITY = 3.5

var movement_input : Vector2 = Vector2.ZERO
var dialogue_active : bool = false

func _ready():
	_initialize_state_machine()
	add_to_group("player")  # Add player to group for NPC to find
	
func _initialize_state_machine():
	# Define State Transitions
	state_machine.add_transition(state_machine.ANYSTATE,move_state,"to_move")
	state_machine.add_transition(state_machine.ANYSTATE,idle_state,"to_idle")
	state_machine.add_transition(state_machine.ANYSTATE,jump_state,"to_jump")
	state_machine.add_transition(state_machine.ANYSTATE,fall_state,"to_fall")

	# Setup State Machine
	state_machine.initial_state = idle_state
	state_machine.initialize(self)
	state_machine.set_active(true)
	
func check_jump_input():
	if not dialogue_active and Input.is_action_just_pressed("jump"):
		state_machine.dispatch("to_jump")
	
func update_sprite_direction():
	if movement_input.x != 0:
		animated_sprite_3D.flip_h = movement_input.x < 0	
	
func apply_movement(delta):
	velocity.x = movement_input.x * SPEED
	velocity.z = movement_input.y * SPEED

func _physics_process(delta) -> void:
	# Add the gravity.
	if not is_on_floor():
		velocity += get_gravity() * delta
	
	# Disable movement during dialogue
	if not dialogue_active:
		movement_input = Input.get_vector("left","right","up","down")
		move_and_slide()
	else:
		# Stop movement completely during dialogue
		movement_input = Vector2.ZERO
		velocity = Vector3.ZERO
		move_and_slide()

# Function to set dialogue active state
func set_dialogue_active(is_active: bool):
	dialogue_active = is_active
	print("Player movement " + ("disabled" if is_active else "enabled"))
