//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// ORIGINAL SOURCE:
// RotatingTranslatedTriangle.js (c) 2012 matsuda
// HIGHLY MODIFIED to make:
//
// BouncyBall.js  for EECS 351-1,
//									Northwestern Univ. Jack Tumblin
//  (see previous week's starter code for earlier versions)
//  PartSysBouncy10:---------------------
//    --UPDATE keyboard handler to eliminate now-deprecated 'KeyPress' callback.
//			as the program starts, when users press the 'R' key too ('deep reset').
//			Make a related function for the 'r' key that updates only the velocities
//			for all particles in the current state.
//    --add 'f/F' key to toggle age constraint (particle fountain).
//    --Refine 'partSys.js' file to hold PartSys prototype & related items.
//    --SIMPLIFY, REDISTRIBUTE our still-too-large 'draw' function:
//      1) move the constraint-applying code to the 'g_partA.applyConstraints().
//      Improve it: apply constraints to ALL particles in the state-variable(s).
//      2) Replace the tedious variable-by-variable swapping of s1,s2 elements
//      in drawAll() with a call to 'g_partA.swap()', a function that switches
//			the contents of the s1  and s2 state vars (see week2 starter code named
//        'swapTest' to BE SURE it swaps references only; NOT a 'deep copy'!!)
//      3) Move particle-movement-solving code from 'draw()' to partA.solver().
//  PartSysBouncy12:
//      4) Add particle-aging constraint: 'f/F' key toggles fire-like 'fountain'
//      5) Update 'drawAll()' to follow the recommended simulation loop given
//        in lecture notes D :
//      ApplyAllForces(), dotFinder(), Solver(), doConstraint(), Swap(), Render(),
//      (also: remove unneeded swap() calls at start of Solver()!)
//  PartSysBouncy13:
//      5) Create s1dot state var (in PartSys.prototype.initBouncy2D() fcn),
//        Create a force-applying 'CForcer' object prototype and constraint-applying
//        object 'CLimit' at the end of PartSys05
//      6) In PartSys.initBouncy2D(),create 'this.forceList' array of CForcers
//        and 'push' a CForcer for Earth gravity onto the array;
//        Create 'this.limitList' array of CLimit objects and 'push' a CLimit
//        object for our LIM_VOL box-like enclosure onto the array;
//      7) implement the 'applyForces()' and 'dotFinder()' functions using
//        g_PartA.forceList array, the g_partA.s1 array, and g_partA.s1dot array.
//      8) use s1,s2, and s1dot to implement Euler solver in solver().
//  PartSysBouncy14:
//      9) correct bugs (e.g. solver() SOLV_EULER loop indices & array indices;
//        single-step),
//       clean up code for keyDown(), add a 'drag' CForcer SOLV_EULER needed;
//       add CForcer.printMe(),

//      update the 'doConstraints()' function to use CLimit objects in
//        g_partA.limitList() to implement the box that holds our particles..
//  MyPartSysBouncy3D 01:
//      10) Adjusted controls to free up the 'S' and 'D' keys

//==============================================================================
// Vertex shader program:
var VSHADER_SOURCE =
  "precision mediump float;\n" + // req'd in OpenGL ES if we use 'float'
  //
  "uniform   int u_runMode; \n" + // particle system state:
  // 0=reset; 1= pause; 2=step; 3=run
  "attribute vec4 a_Position;\n" +
  "uniform   mat4 u_mvpMat;\n" +
  "varying   vec4 v_Color; \n" +
  "void main() {\n" +
  "  gl_PointSize = 20.0;\n" + // TRY MAKING THIS LARGER...
  // "	 gl_Position = a_Position; \n" +
  "	 gl_Position = u_mvpMat * a_Position; \n" +
  // Let u_runMode determine particle color:
  "  if(u_runMode == 0) { \n" +
  "	   v_Color = vec4(1.0, 0.0, 0.0, 1.0);	\n" + // red: 0==reset
  "  	 } \n" +
  "  else if(u_runMode == 1) {  \n" +
  "    v_Color = vec4(1.0, 1.0, 0.0, 1.0); \n" + // yellow: 1==pause
  "    }  \n" +
  "  else if(u_runMode == 2) { \n" +
  "    v_Color = vec4(1.0, 1.0, 1.0, 1.0); \n" + // white: 2==step
  "    } \n" +
  "  else { \n" +
  "    v_Color = vec4(0.2, 1.0, 0.2, 1.0); \n" + // green: >=3 ==run
  "		 } \n" +
  "} \n";
// Each instance computes all the on-screen attributes for just one VERTEX,
// supplied by 'attribute vec4' variable a_Position, filled from the
// Vertex Buffer Object (VBO) created in g_partA.init().

//==============================================================================
// Fragment shader program:
var FSHADER_SOURCE =
  "precision mediump float;\n" +
  "varying vec4 v_Color; \n" +
  "void main() {\n" +
  "  float dist = distance(gl_PointCoord, vec2(0.5, 0.5)); \n" +
  "  if(dist < 0.5) { \n" +
  "  	gl_FragColor = vec4((1.0-2.0*dist)*v_Color.rgb, 1.0);\n" +
  "  } else { discard; }\n" +
  "}\n";
// --Each instance computes all the on-screen attributes for just one PIXEL.
// --Draw large POINTS primitives as ROUND instead of square.  HOW?
//   See pg. 377 in  textbook: "WebGL Programming Guide".  The vertex shaders'
// gl_PointSize value sets POINTS primitives' on-screen width and height, and
// by default draws POINTS as a square on-screen.  In the fragment shader, the
// built-in input variable 'gl_PointCoord' gives the fragment's location within
// that 2D on-screen square; value (0,0) at squares' lower-left corner, (1,1) at
// upper right, and (0.5,0.5) at the center.  The built-in 'distance()' function
// lets us discard any fragment outside the 0.5 radius of POINTS made circular.
// (CHALLENGE: make a 'soft' point: color falls to zero as radius grows to 0.5)?
// -- NOTE! gl_PointCoord is UNDEFINED for all drawing primitives except POINTS;
// thus our 'draw()' function can't draw a LINE_LOOP primitive unless we turn off
// our round-point rendering.
// -- All built-in variables: http://www.opengl.org/wiki/Built-in_Variable_(GLSL)

// Global Variables
// =========================
// Use globals to avoid needlessly complex & tiresome function argument lists.
// For example, the WebGL rendering context 'gl' gets used in almost every fcn;
// requiring 'gl' as an argument won't give us any added 'encapsulation'; make
// it global.  Later, if the # of global vars grows, we can unify them in to
// one (or just a few) sensible global objects for better modularity.

var gl; // webGL Rendering Context.  Created in main(), used everywhere.
var g_canvas = document.getElementById("webgl"); // our HTML-5 canvas object that uses 'gl' for drawing.
var g_digits = 5; // # of digits printed on-screen (e.g. x.toFixed(g_digits);

// For keyboard, mouse-click-and-drag: -----------------
var isDrag = false; // mouse-drag: true when user holds down mouse button
var xMclik = 0.0; // last mouse button-down position (in CVV coords)
var yMclik = 0.0;
var xMdragTot = 0.0; // total (accumulated) mouse-drag amounts (in CVV coords).
var yMdragTot = 0.0;

var qNew = new Quaternion(0, 0, 0, 1); // most-recent mouse drag's rotation
var qTot = new Quaternion(0, 0, 0, 1); // 'current' orientation (made from qNew)
var quatMatrix = new Matrix4(); // rotation matrix, made from latest qTot

var mvpMat = new Matrix4();
var u_mvpMat_loc;

// For projections, dimensions of camera...: -----------------

var gridScale = 10; //# of lines per 1 x 1 unit
var gridHeight = -2;

var viewWidth;
var viewHeight;
var zNear = 1;
// var zFar = gridScale * 2;
var zFar = 1000;

var persFovy = 40.0;
var persAspect;

var adjustedView = (zFar - zNear) / 3;
var theta = 0;
var zDelta = 0;

var orthoWidth;
var orthoHeight;

//variables for lookAt() func
//  'Center' or 'Eye Point',
var eyeAt = [0, 6, 1, 1];
//  look-At point
////var lookAt = [0, 0, 0, 1];
var lookAtx = 0;
var lookAty = 0;
var lookAtz = 0;

var upVector = [0, 0, 1, 0];

var cameraControl = true;
var drawGrid = false;
var moveVelocity = 0.125; //How close to 1 unit they move with each step.

// !To see if I can get the vertex shader color working
// TODO didnt work

var myRunMode = 3;

//--Animation---------------
var g_isClear = 1; // 0 or 1 to enable or disable screen-clearing in the
// draw() function. 'C' or 'c' key toggles in myKeyPress().
var g_last = Date.now(); //  Timestamp: set after each frame of animation,
// used by 'animate()' function to find how much
// time passed since we last updated our canvas.
var g_stepCount = 0; // Advances by 1 for each timestep, modulo 1000,
// (0,1,2,3,...997,998,999,0,1,2,..) to identify
// WHEN the ball bounces.  RESET by 'r' or 'R' key.

var g_timeStep = 1000.0 / 60.0; // current timestep in milliseconds (init to 1/60th sec)
var g_timeStepMin = g_timeStep; //holds min,max timestep values since last keypress.
var g_timeStepMax = g_timeStep;

// Our first global particle system object; contains 'state variables' s1,s2;
//---------------------------------------------------------
var g_partA = new PartSys(); // create our first particle-system object;
// for code, see PartSys.js

function main() {
  //==============================================================================
  // Retrieve <canvas> element where we will draw using WebGL
  // g_canvas = document.getElementById("webgl"); added to beginning
  gl = g_canvas.getContext("webgl", { preserveDrawingBuffer: true });
  // NOTE:{preserveDrawingBuffer: true} disables HTML-5default screen-clearing,
  // so that our draw() function will over-write previous on-screen results
  // until we call the gl.clear(COLOR_BUFFER_BIT); function. )
  if (!gl) {
    console.log("main() Failed to get the rendering context for WebGL");
    return;
  }
  // Register the Keyboard & Mouse Event-handlers------------------------------
  // When users move, click or drag the mouse and when they press a key on the
  // keyboard the operating system creates a simple text-based 'event' message.
  // Your Javascript program can respond to 'events' if you:
  // a) tell JavaScript to 'listen' for each event that should trigger an
  //   action within your program: call the 'addEventListener()' function, and
  // b) write your own 'event-handler' function for each of the user-triggered
  //    actions; Javascript's 'event-listener' will call your 'event-handler'
  //		function each time it 'hears' the triggering event from users.
  //
  // KEYBOARD:----------------------------------------------
  // The 'keyDown' and 'keyUp' events respond to ALL keys on the keyboard,
  //      including shift,alt,ctrl,arrow, pgUp, pgDn,f1,f2...f12 etc.
  window.addEventListener("keydown", myKeyDown, false);
  // After each 'keydown' event, call the 'myKeyDown()' function.  The 'false'
  // arg (default) ensures myKeyDown() call in 'bubbling', not 'capture' stage)
  // ( https://www.w3schools.com/jsref/met_document_addeventlistener.asp )
  window.addEventListener("keyup", myKeyUp, false);
  // Called when user RELEASES the key.  Now rarely used...
  // MOUSE:--------------------------------------------------
  // Create 'event listeners' for a few vital mouse events
  // (others events are available too... google it!).
  window.addEventListener("mousedown", myMouseDown);
  // (After each 'mousedown' event, browser calls the myMouseDown() fcn.)
  window.addEventListener("mousemove", myMouseMove);
  window.addEventListener("mouseup", myMouseUp);
  window.addEventListener("click", myMouseClick);
  window.addEventListener("dblclick", myMouseDblClick);
  // Note that these 'event listeners' will respond to mouse click/drag
  // ANYWHERE, as long as you begin in the browser window 'client area'.
  // You can also make 'event listeners' that respond ONLY within an HTML-5
  // element or division. For example, to 'listen' for 'mouse click' only
  // within the HTML-5 canvas where we draw our WebGL results, try:
  // g_canvasID.addEventListener("click", myCanvasClick);
  //
  // Wait wait wait -- these 'event listeners' just NAME the function called
  // when the event occurs!   How do the functionss get data about the event?
  //  ANSWER1:----- Look it up:
  //    All event handlers receive one unified 'event' object:
  //	  https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
  //  ANSWER2:----- Investigate:
  // 		All Javascript functions have a built-in local variable/object named
  //    'argument'.  It holds an array of all values (if any) found in within
  //	   the parintheses used in the function call.
  //     DETAILS:  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments
  // END Keyboard & Mouse Event-Handlers---------------------------------------

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log("main() Failed to intialize shaders.");
    return;
  }
  gl.clearColor(0.25, 0.25, 0.25, 1); // RGBA color for clearing WebGL framebuffer
  gl.clear(gl.COLOR_BUFFER_BIT); // clear it once to set that color as bkgnd.

  u_mvpMat_loc = gl.getUniformLocation(gl.program, "u_mvpMat");

  if (!u_mvpMat_loc) {
    console.log("Failed to get u_ModelMatrix variable location");
    return;
  }

  
  // Get graphics system storage location of uniforms our shaders use:
  // (why? see  http://www.opengl.org/wiki/Uniform_(GLSL) )
  u_runModeID = gl.getUniformLocation(gl.program, 'u_runMode');
  if(!u_runModeID) {
  	console.log('Failed to get u_runMode variable location');
  	return;
  }
	gl.uniform1i(u_runModeID, myRunMode);	

  // Initialize Particle systems:
  g_partA.initBouncy2D(200); // create a 2D bouncy-ball system where
  // 2 particles bounce within -0.9 <=x,y<0.9
  // and z=0.
  printControls(); // Display (initial) particle system values as text on webpage

  // Quick tutorial on synchronous, real-time animation in JavaScript/HTML-5:
  //  	http://creativejs.com/resources/requestanimationframe/
  //		--------------------------------------------------------
  // Why use 'requestAnimationFrame()' instead of the simple-to-use
  //	fixed-time setInterval() or setTimeout() functions?  Because:
  //		1) it draws the next animation frame 'at the next opportunity' instead
  //			of a fixed time interval. It allows your browser and operating system
  //			to manage its own processes, power, and computing loads and respond to
  //			on-screen window placement (skip battery-draining animation in any
  //			window hidden behind others, or scrolled off-screen)
  //		2) it helps your program avoid 'stuttering' or 'jittery' animation
  //			due to delayed or 'missed' frames.  Your program can read and respond
  //			to the ACTUAL time interval between displayed frames instead of fixed
  //		 	fixed-time 'setInterval()' calls that may take longer than expected.
  var tick = function () {
    g_timeStep = animate();
    // find how much time passed (in milliseconds) since the
    // last call to 'animate()'.
    if (g_timeStep > 200) {
      // did we wait > 0.2 seconds?
      // YES. That's way too long for a single time-step; somehow our particle
      // system simulation got stopped -- perhaps user switched to a different
      // browser-tab or otherwise covered our browser window's HTML-5 canvas.
      // Resume simulation with a normal-sized time step:
      g_timeStep = 1000 / 60;
    }
    // Update min/max for timeStep:
    if (g_timeStep < g_timeStepMin) g_timeStepMin = g_timeStep;
    else if (g_timeStep > g_timeStepMax) g_timeStepMax = g_timeStep;
    drawAll(g_partA.partCount); // compute new particle state at current time
    requestAnimationFrame(tick, g_canvas);
    // Call tick() again 'at the next opportunity' as seen by
    // the HTML-5 element 'g_canvas'.
  };
  tick();

  drawResize();
}

function animate() {
  //==============================================================================
  // Returns how much time (in milliseconds) passed since the last call to this fcn.
  var now = Date.now();
  var elapsed = now - g_last; // amount of time passed, in integer milliseconds
  g_last = now; // re-set our stopwatch/timer.

  // INSTRUMENTATION:  (delete if you don't care how much the time-steps varied)
  g_stepCount = (g_stepCount + 1) % 1000; // count 0,1,2,...999,0,1,2,...
  //-----------------------end instrumentation
  return elapsed;
}

function drawAll() {
  //==============================================================================
  // Clear WebGL frame-buffer? (The 'c' or 'C' key toggles g_isClear between 0 & 1).
  if (g_isClear == 1) gl.clear(gl.COLOR_BUFFER_BIT);
  // *** SURPRISE! ***
  //  What happens when you forget (or comment-out) this gl.clear() call?
  // In OpenGL (but not WebGL), you'd see 'trails' of particles caused by drawing
  // without clearing any previous drawing. But not in WebGL; by default, HTML-5
  // clears the canvas to white (your browser's default webpage color).  To see
  // 'trails' in WebGL you must disable the canvas' own screen clearing.  HOW?
  // -- in main() where we create our WebGL drawing context,
  // replace this (default):
  //          gl = g_canvas.getContext("webgl");
  // -- with this:
  //          gl = g_canvas.getContext("webgl", { preserveDrawingBuffer: true});
  // -- To learn more, see:
  // https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext

  //
  //---Camera Calulations---//
  //

  // Assign value to mvpMatrix
  mvpMat.setIdentity();
  // g_mvpMatrix.setIdentity(); // DEFINE 'world-space' coords.##

  var viewWidth = g_canvas.width; //Taken from Project B
  var viewHeight = g_canvas.height; //Taken from Project B

  //   //var dist = Math.sqrt(g_xMdragTot * g_xMdragTot + g_yMdragTot * g_yMdragTot); //Disregard

  //----------------------Create, fill Perspective viewport------------------------
  //Taken from Project B
  //prettier-ignore
  gl.viewport(0,											// Viewport lower-left corner
                   0, 			// location(in pixels)
                   viewWidth, 				// viewport width,
                   viewHeight); // viewport height in pixels.

  persAspect =
    viewWidth / // On-screen aspect ratio for
    viewHeight; // this camera: width/height.

  if (cameraControl) {
    zDelta = -yMdragTot;
    theta = ((xMdragTot + 0.0001) * Math.PI) / 2 + Math.PI;
  }

  lookAtx = eyeAt[0] - Math.sin(theta);
  lookAty = eyeAt[1] + Math.cos(theta);
  lookAtz = eyeAt[2] + zDelta;

  // For this viewport, set camera's eye point and the viewing volume:
  //prettier-ignore
  mvpMat.setPerspective( persFovy,  // fovy: y-axis field-of-view in degrees
                                          // (top <-> bottom in view frustum)
                                persAspect, // aspect ratio: width/height
                                zNear, zFar); // near, far (always >0).
  //prettier-ignore
  mvpMat.lookAt(eyeAt[0], eyeAt[1], eyeAt[2], 				// 'Center' or 'Eye Point',
  				lookAtx, lookAty, lookAtz, 					// look-At point,
  				upVector[0], upVector[1], upVector[2]); // View UP vector, all in 'world' coords.

  gl.uniformMatrix4fv(u_mvpMat_loc, false, mvpMat.elements);

  // update particle system state? =====================
  if (g_partA.runMode > 1) {
    // 0=reset; 1= pause; 2=step; 3=run
    // YES! advance particle system(s) by 1 timestep.
    if (g_partA.runMode == 2) {
      // (if runMode==2, do just one step & pause)
      g_partA.runMode = 1;
      myRunMode = 1;
    }
    //==========================================
    //===========================================
    //
    //  PARTICLE SIMULATION LOOP: (see Lecture Notes D)
    //
    //==========================================
    //==========================================
    // Make our 'bouncy-ball' move forward by one timestep, but now the 's' key
    // will select which kind of solver to use by changing g_partA.solvType:
    g_partA.applyForces(g_partA.s1, g_partA.forceList); // find current net force on each particle
    g_partA.dotFinder(g_partA.s1dot, g_partA.s1); // find time-derivative s1dot from s1;
    g_partA.solver(); // find s2 from s1 & related states.
    g_partA.doConstraints(); // Apply all constraints.  s2 is ready!
    g_partA.render(); // transfer current state to VBO, set uniforms, draw it!
    g_partA.swap(); // Make s2 the new current state s1.s
    //===========================================
    //===========================================
  } else {
    // runMode==0 (reset) or ==1 (pause): re-draw existing particles.
    g_partA.render();
  }
  printControls(); // Display particle-system status on-screen.
  // Report mouse-drag totals since last re-draw:
  document.getElementById("MouseResult0").innerHTML =
    "Mouse Drag totals (CVV coords):\t" +
    xMdragTot.toFixed(g_digits) +
    ", \t" +
    yMdragTot.toFixed(g_digits);
}

//===================Mouse and Keyboard event-handling Callbacks===============
//=============================================================================
function myMouseDown(ev) {
  //=============================================================================
  // Called when user PRESSES down any mouse button;
  // 									(Which button?    console.log('ev.button='+ev.button);   )
  // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage
  //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)

  // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect(); // get canvas corners in pixels
  var xp = ev.clientX - rect.left; // x==0 at canvas left edge
  var yp = g_canvas.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
  //  console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);

  // Convert to Canonical View Volume (CVV) coordinates too:
  var x =
    (xp - g_canvas.width / 2) / // move origin to center of canvas and
    (g_canvas.width / 2); // normalize canvas to -1 <= x < +1,
  var y =
    (yp - g_canvas.height / 2) / //										 -1 <= y < +1.
    (g_canvas.height / 2);
  //	console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);

  isDrag = true; // set our mouse-dragging flag
  xMclik = x; // record where mouse-dragging began
  yMclik = y;
  document.getElementById("MouseResult1").innerHTML =
    "myMouseDown() at CVV coords x,y = " +
    x.toFixed(g_digits) +
    ", " +
    y.toFixed(g_digits) +
    "<br>";
}

function myMouseMove(ev) {
  //==============================================================================
  // Called when user MOVES the mouse with a button already pressed down.
  // 									(Which button?   console.log('ev.button='+ev.button);    )
  // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage
  //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)

  if (isDrag == false) return; // IGNORE all mouse-moves except 'dragging'

  // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect(); // get canvas corners in pixels
  var xp = ev.clientX - rect.left; // x==0 at canvas left edge
  var yp = g_canvas.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
  //  console.log('myMouseMove(pixel coords): xp,yp=\t',xp.toFixed(g_digits),',\t',yp.toFixed(g_digits));

  // Convert to Canonical View Volume (CVV) coordinates too:
  var x =
    (xp - g_canvas.width / 2) / // move origin to center of canvas and
    (g_canvas.width / 2); // normalize canvas to -1 <= x < +1,
  var y =
    (yp - g_canvas.height / 2) / //										 -1 <= y < +1.
    (g_canvas.height / 2);
  //	console.log('myMouseMove(CVV coords  ):  x, y=\t',x,',\t',y);

  // find how far we dragged the mouse:
  xMdragTot += x - xMclik; // Accumulate change-in-mouse-position,&
  yMdragTot += y - yMclik;
  xMclik = x; // Make next drag-measurement from here.
  yMclik = y;
  // (? why no 'document.getElementById() call here, as we did for myMouseDown()
  // and myMouseUp()? Because the webpage doesn't get updated when we move the
  // mouse. Put the web-page updating command in the 'draw()' function instead)
}

function myMouseUp(ev) {
  //==============================================================================
  // Called when user RELEASES mouse button pressed previously.
  // 									(Which button?   console.log('ev.button='+ev.button);    )
  // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage
  //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)

  // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect(); // get canvas corners in pixels
  var xp = ev.clientX - rect.left; // x==0 at canvas left edge
  var yp = g_canvas.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
  //  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);

  // Convert to Canonical View Volume (CVV) coordinates too:
  var x =
    (xp - g_canvas.width / 2) / // move origin to center of canvas and
    (g_canvas.width / 2); // normalize canvas to -1 <= x < +1,
  var y =
    (yp - g_canvas.height / 2) / //										 -1 <= y < +1.
    (g_canvas.height / 2);
  //	console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);

  isDrag = false; // CLEAR our mouse-dragging flag, and
  // accumulate any final bit of mouse-dragging we did:
  xMdragTot += x - xMclik;
  yMdragTot += y - yMclik;
  //	console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot.toFixed(g_digits),',\t',
  //	                                               yMdragTot.toFixed(g_digits));
  // Put it on our webpage too...
  document.getElementById("MouseResult1").innerHTML =
    "myMouseUp() at CVV coords x,y = " + x + ", " + y + "<br>";
}

function myMouseClick(ev) {
  //=============================================================================
  // Called when user completes a mouse-button single-click event
  // (e.g. mouse-button pressed down, then released)
  //
  //    WHICH button? try:  console.log('ev.button='+ev.button);
  // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage
  //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)
  //    See myMouseUp(), myMouseDown() for conversions to  CVV coordinates.
  // STUB
  //	console.log("myMouseClick() on button: ", ev.button);
}

function myMouseDblClick(ev) {
  //=============================================================================
  // Called when user completes a mouse-button double-click event
  //
  //    WHICH button? try:  console.log('ev.button='+ev.button);
  // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage
  //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)
  //    See myMouseUp(), myMouseDown() for conversions to  CVV coordinates.
  // STUB
  //	console.log("myMouse-DOUBLE-Click() on button: ", ev.button);
}

function myKeyDown(kev) {
  //============================================================================
  // Called when user presses down ANY key on the keyboard;
  //
  // For a light, easy explanation of keyboard events in JavaScript,
  // see:    http://www.kirupa.com/html5/keyboard_events_in_javascript.htm
  // For a thorough explanation of a mess of JavaScript keyboard event handling,
  // see:    http://javascript.info/tutorial/keyboard-events
  //
  // NOTE: Mozilla deprecated the 'keypress' event entirely, and in the
  //        'keydown' event deprecated several read-only properties I used
  //        previously, including kev.charCode, kev.keyCode.
  //        Revised 2/2019:  use kev.key and kev.code instead.
  //
  /*
	// On console, report EVERYTHING about this key-down event:  
  console.log("--kev.code:",      kev.code,   "\t\t--kev.key:",     kev.key, 
              "\n--kev.ctrlKey:", kev.ctrlKey,  "\t--kev.shiftKey:",kev.shiftKey,
              "\n--kev.altKey:",  kev.altKey,   "\t--kev.metaKey:", kev.metaKey);
*/
  // On webpage, report EVERYTING about this key-down event:
  document.getElementById("KeyDown").innerHTML = ""; // clear old result
  document.getElementById("KeyMod").innerHTML = "";
  document.getElementById("KeyMod").innerHTML =
    "   --kev.code:" +
    kev.code +
    "      --kev.key:" +
    kev.key +
    "<br>--kev.ctrlKey:" +
    kev.ctrlKey +
    " --kev.shiftKey:" +
    kev.shiftKey +
    "<br> --kev.altKey:" +
    kev.altKey +
    "  --kev.metaKey:" +
    kev.metaKey;

  // RESET our g_timeStep min/max recorder on every key-down event:
  g_timeStepMin = g_timeStep;
  g_timeStepMax = g_timeStep;

  switch (kev.code) {
    case "Digit0":
      g_partA.runMode = 0; // RESET!
      myRunMode = 0;
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() digit 0 key. Run Mode 0: RESET!"; // print on webpage,
      console.log("Run Mode 0: RESET!"); // print on console.
      break;
    case "Digit1":
      g_partA.runMode = 1; // PAUSE!
      myRunMode = 1;
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() digit 1 key. Run Mode 1: PAUSE!"; // print on webpage,
      console.log("Run Mode 1: PAUSE!"); // print on console.
      break;
    case "Digit2":
      g_partA.runMode = 2; // STEP!
      myRunMode = 2;
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() digit 2 key. Run Mode 2: STEP!"; // print on webpage,
      console.log("Run Mode 2: STEP!"); // print on console.
      break;
    case "Digit3":
      g_partA.runMode = 3; // RESET!
      myRunMode = 3;
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() digit 3 key. Run Mode 3: RUN!"; // print on webpage,
      console.log("Run Mode 3: RUN!"); // print on console.
      break;
    case "KeyB": // Toggle floor-bounce constraint type
      if (g_partA.bounceType == 0) g_partA.bounceType = 1;
      // impulsive vs simple
      else g_partA.bounceType = 0;
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() b/B key: toggle bounce mode."; // print on webpage,
      console.log("b/B key: toggle bounce mode."); // print on console.
      break;
    case "KeyC": // Toggle screen-clearing to show 'trails'
      g_isClear += 1;
      if (g_isClear > 1) g_isClear = 0;
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() c/C key: toggle screen clear."; // print on webpage,
      console.log("c/C: toggle screen-clear g_isClear:", g_isClear); // print on console,
      break;
    case "KeyT": // 't'  INCREASE drag loss; 'T' to DECREASE drag loss
      if (kev.shiftKey == false) g_partA.drag *= 0.995;
      // permit less movement.
      else {
        g_partA.drag *= 1.0 / 0.995;
        if (g_partA.drag > 1.0) g_partA.drag = 1.0; // don't let drag ADD energy!
      }
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() t/T key: grow/shrink drag."; // print on webpage,
      console.log("t/T: grow/shrink drag:", g_partA.drag); // print on console,
      break;
    case "KeyF": // 'f' or 'F' to toggle particle fountain on/off
      g_partA.isFountain += 1;
      if (g_partA.isFountain > 1) g_partA.isFountain = 0;
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() f/F key: toggle age constraint (fountain)."; // print on webpage,
      console.log("F: toggle age constraint (fountain)."); // print on console,
      break;
    case "KeyG": // 'g' to REDUCE gravity; 'G' to increase.
      if (kev.shiftKey == false) g_partA.grav *= 0.99;
      // shrink 1%
      else g_partA.grav *= 1.0 / 0.98; // grow 2%
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() g/G key: shrink/grow gravity."; // print on webpage,
      console.log("g/G: shrink/grow gravity:", g_partA.grav); // print on console,
      break;
    case "KeyM": // 'm' to REDUCE mass; 'M' to increase.
      if (kev.shiftKey == false) g_partA.mass *= 0.98;
      // shrink 2%
      else g_partA.mass *= 1.0 / 0.98; // grow 2%
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() m/M key: shrink/grow mass."; // print on webpage,
      console.log("m/M: shrink/grow mass:", g_partA.mass); // print on console,
      break;
    case "KeyP":
      if (g_partA.runMode == 3){
        g_partA.runMode = 1;
        myRunMode = 1;
      } 
      // if running, pause
      else{
        g_partA.runMode = 3;
        myRunMode = 3;
      } // if paused, run.
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() p/P key: toggle Pause/unPause!"; // print on webpage
      console.log("p/P key: toggle Pause/unPause!"); // print on console,
      break;
    case "KeyR": // r/R for RESET:
      if (kev.shiftKey == false) {
        // 'r' key: SOFT reset; boost velocity only
        g_partA.runMode = 3; // RUN!
        myRunMode = 3;
        var j = 0; // array index for particle i
        for (var i = 0; i < g_partA.partCount; i += 1, j += PART_MAXVAR) {
          g_partA.roundRand(); // make a spherical random var.
          if (g_partA.s2[j + PART_XVEL] > 0.0)
            // ADD to positive velocity, and
            g_partA.s2[j + PART_XVEL] +=
              1.7 + 0.4 * g_partA.randX * g_partA.INIT_VEL;
          // SUBTRACT from negative velocity:
          else
            g_partA.s2[j + PART_XVEL] -=
              1.7 + 0.4 * g_partA.randX * g_partA.INIT_VEL;

          if (g_partA.s2[j + PART_YVEL] > 0.0)
            g_partA.s2[j + PART_YVEL] +=
              1.7 + 0.4 * g_partA.randY * g_partA.INIT_VEL;
          else
            g_partA.s2[j + PART_YVEL] -=
              1.7 + 0.4 * g_partA.randY * g_partA.INIT_VEL;

          if (g_partA.s2[j + PART_ZVEL] > 0.0)
            g_partA.s2[j + PART_ZVEL] +=
              1.7 + 0.4 * g_partA.randZ * g_partA.INIT_VEL;
          else
            g_partA.s2[j + PART_ZVEL] -=
              1.7 + 0.4 * g_partA.randZ * g_partA.INIT_VEL;
        }
      } else {
        // HARD reset: position AND velocity, BOTH state vectors:
        g_partA.runMode = 0; // RESET!
        myRunMode = 0;
        // Reset state vector s1 for ALL particles:
        var j = 0; // array index for particle i
        for (var i = 0; i < g_partA.partCount; i += 1, j += PART_MAXVAR) {
          g_partA.roundRand();
          g_partA.s2[j + PART_XPOS] = -0.9; // lower-left corner of CVV
          g_partA.s2[j + PART_YPOS] = -0.9; // with a 0.1 margin
          g_partA.s2[j + PART_ZPOS] = 0.0;
          g_partA.s2[j + PART_XVEL] =
            3.7 + 0.4 * g_partA.randX * g_partA.INIT_VEL;
          g_partA.s2[j + PART_YVEL] =
            3.7 + 0.4 * g_partA.randY * g_partA.INIT_VEL; // initial velocity in meters/sec.
          g_partA.s2[j + PART_ZVEL] =
            3.7 + 0.4 * g_partA.randZ * g_partA.INIT_VEL;
          // do state-vector s2 as well: just copy all elements of the float32array.
          g_partA.s2.set(g_partA.s1);
        } // end for loop
      } // end HARD reset
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() r/R key: soft/hard Reset."; // print on webpage,
      console.log("r/R: soft/hard Reset"); // print on console,
      break;
    case "KeyE":
      if (g_partA.solvType == SOLV_EULER) g_partA.solvType = SOLV_OLDGOOD;
      else g_partA.solvType = SOLV_EULER;
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found e/E key. Switch solvers!"; // print on webpage.
      console.log("e/E: Change Solver:", g_partA.solvType); // print on console.
      break;
    case "KeyW":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found w/W key. Move FWD!";
      eyeAt[0] -= Math.sin(theta) * moveVelocity;
      eyeAt[1] += Math.cos(theta) * moveVelocity;
      eyeAt[2] += Math.sin(Math.atan(zDelta)) * moveVelocity;
      break;
    case "KeyA":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found a/A key. Strafe LEFT!";
      eyeAt[0] -= Math.sin(theta + Math.PI / 2) * moveVelocity;
      eyeAt[1] += Math.cos(theta + Math.PI / 2) * moveVelocity;
      break;
    case "KeyS":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found s/Sa key. Move BACK.";
      eyeAt[0] += Math.sin(theta) * moveVelocity;
      eyeAt[1] -= Math.cos(theta) * moveVelocity;
      eyeAt[2] -= Math.sin(Math.atan(zDelta)) * moveVelocity;
      break;
    case "KeyD":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found d/D key. Strafe RIGHT!";
      eyeAt[0] += Math.sin(theta + Math.PI / 2) * moveVelocity;
      eyeAt[1] -= Math.cos(theta + Math.PI / 2) * moveVelocity;
      break;
    case "Space":
      g_partA.runMode = 2;
      myRunMode = 2;
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found Space key. Single-step!"; // print on webpage,
      console.log("SPACE bar: Single-step!"); // print on console.
      break;
    case "ArrowLeft":
      // and print on webpage in the <div> element with id='Result':
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown(): Arrow-Left,keyCode=" + kev.keyCode;
      console.log("Arrow-Left key(UNUSED)");
      break;
    case "ArrowRight":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown(): Arrow-Right,keyCode=" + kev.keyCode;
      console.log("Arrow-Right key(UNUSED)");
      break;
    case "ArrowUp":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown(): Arrow-Up,keyCode=" + kev.keyCode;
      eyeAt[2] += moveVelocity;
      console.log("Arrow-Up key: Going Up!");
      break;
    case "ArrowDown":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown(): Arrow-Down,keyCode=" + kev.keyCode;
      eyeAt[2] -= moveVelocity;
      console.log("Arrow-Up key: Going Down!");
      break;
    default:
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown():UNUSED,keyCode=" + kev.keyCode;
      console.log("UNUSED key:", kev.keyCode);
      break;
  }
}

function myKeyUp(kev) {
  //=============================================================================
  // Called when user releases ANY key on the keyboard.
  // Rarely needed -- most code needs only myKeyDown().

  console.log("myKeyUp():\n--kev.code:", kev.code, "\t\t--kev.key:", kev.key);
}

function printControls() {
  //==============================================================================
  // Print current state of the particle system on the webpage:
  var recipTime = 1000.0 / g_timeStep; // to report fractional seconds
  var recipMin = 1000.0 / g_timeStepMin;
  var recipMax = 1000.0 / g_timeStepMax;
  var solvTypeTxt; // convert solver number to text:
  if (g_partA.solvType == 0) solvTypeTxt = "Explicit--(unstable!)<br>";
  else solvTypeTxt = "Implicit--(stable)<br>";
  var bounceTypeTxt; // convert bounce number to text
  if (g_partA.bounceType == 0) bounceTypeTxt = "Velocity Reverse(no rest)<br>";
  else bounceTypeTxt = "Impulsive (will rest)<br>";
  var fountainText;
  if (g_partA.isFountain == 0) fountainText = "OFF: ageless particles.<br>";
  else fountainText = "ON: re-cycle old particles.<br>";
  var xvLimit = g_partA.s2[PART_XVEL]; // find absolute values of s2[PART_XVEL]
  if (g_partA.s2[PART_XVEL] < 0.0) xvLimit = -g_partA.s2[PART_XVEL];
  var yvLimit = g_partA.s2[PART_YVEL]; // find absolute values of s2[PART_YVEL]
  if (g_partA.s2[PART_YVEL] < 0.0) yvLimit = -g_partA.s2[PART_YVEL];

  document.getElementById("KeyControls").innerHTML =
    "<b>Solver = </b>" +
    solvTypeTxt +
    "<b>Bounce = </b>" +
    bounceTypeTxt +
    "<b>Fountain =</b>" +
    fountainText +
    "<b>drag = </b>" +
    g_partA.drag.toFixed(5) +
    ", <b>grav = </b>" +
    g_partA.grav.toFixed(5) +
    // ", <b>grav_dir = </b>" +
    // g_partA.F_GRAV_E.toFixed(5) +
    " m/s^2; <b>yVel = +/-</b> " +
    yvLimit.toFixed(5) +
    " m/s; <b>xVel = +/-</b> " +
    xvLimit.toFixed(5) +
    " m/s;<br><b>timeStep = </b> 1/" +
    recipTime.toFixed(3) +
    " sec" +
    " <b>min:</b> 1/" +
    recipMin.toFixed(3) +
    " sec" +
    " <b>max:</b> 1/" +
    recipMax.toFixed(3) +
    " sec<br>";
  " <b>stepCount: </b>" + g_stepCount.toFixed(3);
}

function onPlusButton() {
  //==============================================================================
  g_partA.INIT_VEL *= 1.2; // grow
  console.log("Initial velocity: " + g_partA.INIT_VEL);
}

function onMinusButton() {
  //==============================================================================
  g_partA.INIT_VEL /= 1.2; // shrink
  console.log("Initial velocity: " + g_partA.INIT_VEL);
}

function drawResize() {
  //==============================================================================
  // Called when user re-sizes their browser window , because our HTML file
  // contains:  <body onload="main()" onresize="winResize()">

  //Report our current browser-window contents:

  console.log("canvas width,height=", g_canvas.width, g_canvas.height);
  console.log(
    "Browser window: innerWidth,innerHeight=",
    innerWidth,
    innerHeight
  );
  // http://www.w3schools.com/jsref/obj_window.asp

  //Make canvas fill the top 70% of our browser window:
  var xtraMargin = 185; // keep a margin (otherwise, browser adds scroll-bars)
  g_canvas.width = innerWidth - xtraMargin;
  g_canvas.height = (innerHeight * 7) / 10 - xtraMargin;
  // IMPORTANT!  Need a fresh drawing in the re-sized viewports.
  drawAll(); // draw in all viewports.
}
