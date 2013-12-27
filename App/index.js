// This gives us access to readable sensor variables
ejecta.include('backend.js')

ejecta.include('sounds/sounds.js')

var ctx = canvas.getContext('2d')

var objects = new Array() // Our array of objects
var vision = new Array() // The objects in our field of view

var debug = true

// Add 0.001 to a GPS decimal to get ~6 meters
var metersToPixels = 20 // ...pixels equals ~0.65 meters

// How much motion is required for certain actions
var rotateRequiredShoot = 400
var rotateRequiredReload = 450 // Set higher than needed to prevent accidental reloading

// These variables help the weapons feel more "realistic" and keep the sound effects in line by setting the "length" of sound effects
var canShoot = true
var timeCool = 200
var capacity = 8
var magazine = capacity
var timeReload = 300

var maxShotDistance = 10
var minShotDistance = 2
var fieldOfView = 22

var sweepTick = 0
var sweepHeight = 4
var sweepSpeed = 20 // Lower values result in a faster sweep
var canScan = true
var timeScan = 500

/*
ejecta.getText('Nickname', 'Give us a friendly name that you want to be known as', function(text)
{
	console.log(text)
})
*/

function world() // Run once by the GPS function once we have a lock
{
	spawnZombies(75) // 100 seems to be the max if I want ~60 FPS when not in debug mode (which is slower)
}

setInterval(function() // Main game loop
{
	vision.length = 0 // Clear the field of view array on each pass so we get fresh results

    for (var i = 0; i < objects.length; i++) // Set and store the relative bearing for all the objects in the world
    {
        if (objects[i].kind == 'enemy')
        {
            objects[i].bearing = bearing(objects[i].latitude, objects[i].longitude)
            objects[i].distance = distance(objects[i].latitude, objects[i].longitude)

            // Beep if we're "looking" at a zombie
	        if ((compass - fieldOfView) < objects[i].bearing && objects[i].bearing < (compass + fieldOfView))
            {
                if (objects[i].distance > minShotDistance && objects[i].distance < maxShotDistance)
                {
                	vision.push(objects[i])
    	            // sfxBeep.play()
                }
            }
        }
    }

    if (vision.length > 0) // If we're looking at at least one zombie...
    {
		vision.sort(function(a, b) // Sort the vision array to find the zombie that's closest to us
		{
			return a.distance - b.distance
		})
		console.log(vision[0].name, vision[0].distance, vision[0].health)
    }    

    blank() // Place draw calls after this

    // Objects are drawn in a stack.  Things drawn last effectively have a greater z-index and appear on top.

    ctx.fillStyle = '#ff434b'
	ctx.fillRect(0, Math.sin(sweepTick / sweepSpeed) * canvas.height / 2 + canvas.height / 2 - sweepHeight / 2, canvas.width, sweepHeight) // Animate the sweep
	sweepTick++

	if (Math.sin(sweepTick / sweepSpeed) > 0.999 || Math.sin(sweepTick / sweepSpeed) < -0.999)
	{
		scan()
	}

    // Draw the aiming cone for debugging purposes
    if (debug)
    {
    	line((canvas.width / 2) - (canvas.height / 2 * Math.tan(fieldOfView.toRad())), 0, canvas.width / 2, canvas.height / 2, '#4c4c4c')
    	line(canvas.width / 2, canvas.height / 2, (canvas.width / 2) + (canvas.height / 2 * Math.tan(fieldOfView.toRad())), 0, '#4c4c4c')
		circle(canvas.width / 2, canvas.height / 2, maxShotDistance * metersToPixels, '#4c4c4c')
		circle(canvas.width / 2, canvas.height / 2, minShotDistance * metersToPixels, '#4c4c4c')
    }

	polygon(canvas.width / 2, canvas.height / 2, 10, '#ffffff') // Draw the player

	drawObjects()

    if (((90 - 25) < Math.abs(tilt.y)) && (Math.abs(tilt.y) < (90 + 25))) // Gun orientation
    {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // Things are only set up for right handed users right now
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

        if (-rotation.y > rotateRequiredReload) // Reload
        {
            reload()
        }

        if (-rotation.z > rotateRequiredShoot) // Fire
        {
            fire()
            if (vision.length > 0) // If we're looking at at least one zombie...
			{
				shootZombie(vision[0].name, 50)
			}
        }
    }
}, 1000 / 60) // FPS

function blank()
{
	ctx.fillStyle = '#2b2e26'
	ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawObjects()
{
	for (var i = 0; i < objects.length; i++)
    {
	    var x = (canvas.width / 2) + (Math.cos(((objects[i].bearing - compass) + 270).toRad()) * (objects[i].distance * metersToPixels))
	    var y = (canvas.height / 2) + (Math.sin(((objects[i].bearing - compass) + 270).toRad()) * (objects[i].distance * metersToPixels))

	    if (debug)
	    {
	    	ctx.fillStyle = '#ffffff';
    		ctx.fillText(objects[i].name, x + 9, y + 2)
	    }

	    polygon(x, y, 6, '#ff0000')
	}
}

function fire()
{
	if (canShoot)
    {
    	// Flash the screen
    	ctx.fillStyle = '#ff434b'
    	ctx.fillRect(0, 0, canvas.width, canvas.height)

	    if (magazine > 0)
	    {
	        magazine--
	        sfxFire.play()
	        canShoot = false

	        setTimeout(function() {
	            canShoot = true
	        }, timeCool)
	    }
	    else
	    {
	        sfxEmpty.play()
	        canShoot = false

	        setTimeout(function() {
	            canShoot = true
	        }, timeCool)
	    }
	}
}

function reload()
{
	if (canShoot)
    {
	    if (magazine < capacity)
	    {
	        magazine = capacity
	        sfxReload.play()
	        canShoot = false

	        setTimeout(function() {
	            canShoot = true
	        }, timeReload)
	    }
	}
}

function spawnZombies(zombieCount)
{
	for (var i = 0; i < zombieCount; i++)
	{
		var latitude = gps.latitude + ((Math.random() * 0.01) - (Math.random() * 0.01))
        var longitude = gps.longitude + ((Math.random() * 0.01) - (Math.random() * 0.01))

		make('enemy', 'zombie' + i, latitude, longitude, 100)
	}
}

function make(markerKind, markerName, markerLatitude, markerLongitude, markerHealth)
{
    // Make an object with the function's values
	var object = new Object()

    object.kind = markerKind
    object.name = markerName
    object.latitude = markerLatitude
    object.longitude = markerLongitude
    object.health = markerHealth
    object.bearing = null
    object.distance = null

    // Push these values to the database array
	objects.push(object)
}

function shootZombie(zombieName, damage)
{
	var zombie = find(zombieName)
    setTimeout(function() // Add a timeout so the zombie doesn't scream instantly
    {
        objects[zombie].health -= damage
        
        if (objects[zombie].health > 0)
        {
            sfxGroan.play()
        }
        else
        {
            // Kill the zombie if it's health is low enough
            sfxImpact.play()
            // Remove the dead zombie from the database
            objects.splice(zombie, 1)
        }
    }, 200)
}

function scan()
{
	if (canScan)
	{
		sfxBeep.play()
		canScan = false

		setTimeout(function() {
			canScan = true
		}, timeScan)
	}
}