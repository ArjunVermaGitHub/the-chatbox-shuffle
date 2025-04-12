# scripts/game_manager.gd
extends Node

signal time_updated(time_string, day_string)
signal tint_updated(tint_color) # New signal for tint

const SECONDS_IN_DAY = 86400.0 # 24 * 60 * 60

# Export the variable for easy adjustment in the editor or project settings
@export var day_duration_minutes : float = 0.5 # Target duration for a full day in minutes

var time_scale : float = 1.0 # Will be calculated in _ready
var game_time_seconds: float = 0.0 # Start at midnight
var current_day_index: int = 0 # 0 = Sunday

# Day/Night Tint Colors
@export var day_color : Color = Color(1.0, 1.0, 1.0, 0.0) # Fully transparent white (no tint)
@export var night_color : Color = Color(0.0, 0.0, 0.1, 0.5) # Even darker blueish tint with more opacity for exaggeration
@export var sunrise_color : Color = Color(1.0, 0.7, 0.4, 0.15) # Orangey tint
@export var sunset_color : Color = Color(0.9, 0.5, 0.5, 0.2) # Pinkish tint

# Time definitions for transitions (in fractions of a day)
const NIGHT_START = 21.0 / 24.0 # 9 PM
const NIGHT_END = 5.0 / 24.0 # 5 AM
const SUNRISE_START = NIGHT_END # 5 AM
const SUNRISE_END = 7.0 / 24.0 # 7 AM
const DAY_START = SUNRISE_END # 7 AM
const DAY_END = 19.0 / 24.0 # 7 PM
const SUNSET_START = DAY_END # 7 PM
const SUNSET_END = NIGHT_START # 9 PM

const DAY_NAMES = [
	"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
]

func _ready():
	# Calculate time_scale based on desired duration
	if day_duration_minutes <= 0:
		push_warning("Day duration must be positive. Defaulting to 5 minutes.")
		day_duration_minutes = 5.0
	var real_minutes_in_day = 24.0 * 60.0
	time_scale = real_minutes_in_day / day_duration_minutes
	print("GameManager Ready. Calculated Time Scale: ", time_scale, " (1 day in ", day_duration_minutes, " minutes)")

	# Set initial time (e.g., start at 8:00 AM on Sunday)
	game_time_seconds = 8 * 3600
	current_day_index = 0
	print("Starting time: ", get_formatted_time_string())
	# Emit initial tint
	emit_signal("tint_updated", calculate_tint_color())


func _process(delta: float):
	# Advance game time
	game_time_seconds += delta * time_scale

	# Check for day change
	if game_time_seconds >= SECONDS_IN_DAY:
		game_time_seconds = fmod(game_time_seconds, SECONDS_IN_DAY) # Wrap around
		current_day_index = (current_day_index + 1) % 7
		print("Day changed to: ", DAY_NAMES[current_day_index])

	# Emit time update signal
	emit_signal("time_updated", get_formatted_time_string(), DAY_NAMES[current_day_index])
	# Emit tint update signal
	emit_signal("tint_updated", calculate_tint_color())

func get_formatted_time_string() -> String:
	var total_seconds = int(game_time_seconds)
	var hours = total_seconds / 3600
	var minutes = (total_seconds % 3600) / 60
	var period = "AM"
	if hours >= 12:
		period = "PM"
	var hours12 = hours % 12
	if hours12 == 0:
		hours12 = 12
	return "%02d:%02d %s" % [hours12, minutes, period]

func get_current_day_name() -> String:
	return DAY_NAMES[current_day_index]

func calculate_tint_color() -> Color:
	# Use a sinusoidal function to simulate realistic lighting:
	# Peak brightness at 12:00 (noon) and darkest at 00:00 (midnight).
	var time_fraction = game_time_seconds / SECONDS_IN_DAY
	# The cosine function is shifted so that brightness is 1 at noon (0.5) and 0 at midnight (0 or 1).
	var brightness = 0.5 + 0.5 * cos(2 * PI * (time_fraction - 0.5))
	# Exaggerate the difference between night and day by applying a power function to the brightness.
	var exaggerated_brightness = pow(brightness, 3)
	# Interpolate between the night and day tint colors using the exaggerated brightness value.
	return night_color.lerp(day_color, exaggerated_brightness)
