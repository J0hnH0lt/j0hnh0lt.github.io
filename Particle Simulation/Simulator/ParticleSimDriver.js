
var gl;													

var g_canvasID = document.getElementById('webgl');	

var eyeAt = [3, 6, 1, 1];

var springPairLoc =   [3, 1, 1];
var springRopeLoc =   [-1, 1, 1];
var tornadoLoc =      [-4, 1, 1];
var boidsLoc =        [-7, 1, 1];
var bouncyBall3DLoc = [-10, 1, 1];
var reevesFireLoc =   [-13, 1, 1];
var rainLoc =         [-16, 1, 1];

var bouncyball2D = new PartSysVBO(bouncyBall3DLoc);

var bouncyball3D = new PartSysVBO(bouncyBall3DLoc);
var bouncyball3DBox = new VBOboxSquare(bouncyBall3DLoc);

var reevesFire = new PartSysVBO(reevesFireLoc);
var reevesFireBox = new VBOboxSquare(reevesFireLoc);

var rain = new PartSysVBO(rainLoc);
var rainBox = new VBOboxSquare(rainLoc);

var tornado = new PartSysVBO(tornadoLoc);
var tornadoBox = new VBOboxSquare(tornadoLoc);

var springPair = new PartSysVBO(springPairLoc);
var springPairBox = new VBOboxSquare(springPairLoc);

var springRope = new PartSysVBO(springRopeLoc);
var springRopeBox = new VBOboxSquare(springRopeLoc);

var boids = new PartSysVBO(boidsLoc);
var boidsBox = new VBOboxSquare(boidsLoc);

var worldBox = new VBObox0();


// For animation:---------------------
var g_lastMS = Date.now();			

var g_angleNow0  =  0.0; 			  
var g_angleRate0 = 45.0;

var g_angleNow1  = 100.0;       
var g_angleRate1 =  95.0;        
var g_angleMax1  = 150.0;     
var g_angleMin1  =  60.0;
                                //---------------
var g_angleNow2  =  0.0; 			  
var g_angleRate2 = -62.0;			

                                //---------------
var g_posNow0 =  0.0;        
var g_posRate0 = 0.6;        
var g_posMax0 =  0.5;  
var g_posMin0 = -0.5;           
                                // ------------------
var g_posNow1 =  0.0;   
var g_posRate1 = 0.5;  
var g_posMax1 =  1.0;   
var g_posMin1 = -1.0;
                                //---------------

// For mouse/keyboard:------------------------
var g_show0 = 1;							
var g_show1 = 1;					
var g_show2 = 1;       

// For mouse-click-and-drag: -----------------
var g_digits = 5; 
var isDrag = false; 
var xMclik = 0.0;
var yMclik = 0.0;
var xMdragTot = 0.0; // -1.0 to look right
var yMdragTot = 0.0;

// For projections, dimensions of camera...: -----------------

var gridScale = 10; 
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

// var orthoWidth;
// var orthoHeight;

//variables for lookAt() func
//  'Center' or 'Eye Point',
// var eyeAt = [1, 6, 1, 1];
//  look-At point
////var lookAt = [0, 0, 0, 1];
var lookAtx = 0;
var lookAty = 0;
var lookAtz = 0;

var upVector = [0, 0, 1, 0];

var cameraControl = true;
var drawGrid = false;
var moveVelocity = 0.125; //How close to 1 unit they move with each step.

//--Animation---------------
var g_isClear = 1; 
var g_last = Date.now(); 
var g_stepCount = 0; 
var g_timeStep = 1000.0 / 60.0; // current timestep in milliseconds (init to 1/60th sec)
var g_timeStepMin = g_timeStep; //holds min,max timestep values since last keypress.
var g_timeStepMax = g_timeStep;

// GLOBAL CAMERA CONTROL:					// 
g_worldMat = new Matrix4();				

function main() {
//=============================================================================
  
  gl = g_canvasID.getContext("webgl", { preserveDrawingBuffer: true });

  if (!gl) {
    console.log("Failed to get the rendering context for WebGL");
    return;
  }
  gl.clearColor(0.2, 0.2, 0.2, 1); // RGBA color for clearing <canvas>

  gl.enable(gl.DEPTH_TEST);

  // KEYBOARD:----------------------------------------------
  window.addEventListener("keydown", myKeyDown, false);
  window.addEventListener("keyup", myKeyUp, false);
  window.addEventListener("mousedown", myMouseDown);
  window.addEventListener("mousemove", myMouseMove);
  window.addEventListener("mouseup", myMouseUp);
  window.addEventListener("click", myMouseClick);
  window.addEventListener("dblclick", myMouseDblClick);
  


  bouncyball2D.initBouncy2D(200);
  bouncyball2D.initVBO(); //Thank you Jipeng
  // console.log(bouncyball2D.INIT_VEL);

  bouncyball3D.initBouncy3D(300);
  bouncyball3D.initVBO();
  bouncyball3DBox.init(gl);

  reevesFire.initFireReeves(1000);
  reevesFire.initVBO();
  reevesFireBox.init(gl);

  rain.initRain(100);
  rain.initVBO();
  rainBox.init(gl);

  tornado.initTornado(400);
  tornado.initVBO();
  tornadoBox.init(gl);

  springPair.initSpringPair();
  springPair.initVBO();
  springPairBox.init(gl);

  springRope.initSpringRope();
  springRope.initVBO();
  springRopeBox.init(gl);

  boids.initFlocking(100);
  boids.initVBO();
  boidsBox.init(gl);
  
  worldBox.init(gl);



  setCamera(); // TEMPORARY: set a global camera used by ALL VBObox objects...
	
  gl.clearColor(0.2, 0.2, 0.2, 1);
  
  // ==============ANIMATION=============
  var tick = function () {		    
    // locally (within main() only), define our 
                                // self-calling animation function. 
    g_timeStep = animate();
    // find how much time passed (in milliseconds) since the
    // last call to 'animate()'.
    if (g_timeStep > 200) {
      g_timeStep = 1000 / 60;
    }
    // Update min/max for timeStep:
    if (g_timeStep < g_timeStepMin) g_timeStepMin = g_timeStep;
    else if (g_timeStep > g_timeStepMax) g_timeStepMax = g_timeStep;

    requestAnimationFrame(tick, g_canvasID); 

    timerAll(); 
    drawAll();               
    };
  //------------------------------------
  tick(); // do it again!
}

function animate() {
  //==============================================================================
  var now = Date.now();
  var elapsed = now - g_last;
  g_last = now; 

  g_stepCount = (g_stepCount + 1) % 1000; 

  return elapsed;
}

function timerAll() {
//=============================================================================
  var nowMS = Date.now();             
  var elapsedMS = nowMS - g_lastMS; // 
  g_lastMS = nowMS;                   
  if (elapsedMS > 1000.0) {            
    elapsedMS = 1000.0 / 30.0;
    }
}

function drawAll() {
//=============================================================================
  // Clear on-screen HTML-5 <canvas> object:
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  setCamera();

  var b4Draw = Date.now();
  var b4Wait = b4Draw - g_lastMS;

  // update particle system state? =====================
  if (bouncyball2D.runMode > 1) {
    // 0=reset; 1= pause; 2=step; 3=run
    // YES! advance particle system(s) by 1 timestep.
    if (bouncyball2D.runMode == 2) {
      // (if runMode==2, do just one step & pause)
      bouncyball2D.runMode = 1;
      myRunMode = 1;
    }
    //==========================================
    //===========================================
    //
    //  PARTICLE SIMULATION LOOP: (see Lecture Notes D)
    //
    //==========================================
    //==========================================

    // BOUNCYBALL 2D //! bring back
    // bouncyball2D.switchToMe();
    // bouncyball2D.adjust();
    // bouncyball2D.applyForces(bouncyball2D.s1, bouncyball2D.forceList); // find current net force on each particle
    // bouncyball2D.dotFinder(bouncyball2D.s1dot, bouncyball2D.s1); // find time-derivative s1dot from s1;
    // bouncyball2D.solver(); // find s2 from s1 & related states.
    // bouncyball2D.doConstraints(); // Apply all constraints.  s2 is ready!
    // bouncyball2D.render(); // transfer current state to VBO, set uniforms, draw it!
    // bouncyball2D.swap(); // Make s2 the new current state s1.s

    //==========================================
    
    // BOUNCYBALL 3D
    bouncyball3D.switchToMe();
    bouncyball3D.adjust();
    bouncyball3D.applyForces(bouncyball3D.s1, bouncyball3D.forceList); // find current net force on each particle
    bouncyball3D.dotFinder(bouncyball3D.s1dot, bouncyball3D.s1); // find time-derivative s1dot from s1;
    bouncyball3D.solver(); // find s2 from s1 & related states.
    bouncyball3D.doConstraints(bouncyball3D.s1, bouncyball3D.s1dot, bouncyball3D.limitList, bouncyball3D.amICrazy); // Apply all constraints.  s2 is ready!
    bouncyball3D.render(); // transfer current state to VBO, set uniforms, draw it!
    bouncyball3D.swap(); // Make s2 the new current state s1.s
    //===========================================

    // REEVES FIRE
    reevesFire.switchToMe();
    reevesFire.adjust();
    // console.log("Here", reevesFire.forceList)
    reevesFire.applyForces(reevesFire.s1, reevesFire.forceList); // find current net force on each particle
    reevesFire.dotFinder(reevesFire.s1dot, reevesFire.s1); // find time-derivative s1dot from s1;
    reevesFire.solver(); // find s2 from s1 & related states.
    // console.log(reevesFire.isFountain);
    reevesFire.doConstraints(reevesFire.s1, reevesFire.s2, reevesFire.limitList, reevesFire.amICrazy); // Apply all constraints.  s2 is ready!
    reevesFire.render(); // transfer current state to VBO, set uniforms, draw it!
    reevesFire.swap(); // Make s2 the new current state s1.s
    //===========================================

    // RAIN
    rain.switchToMe();
    rain.adjust();
    // console.log("Here", rain.forceList)
    rain.applyForces(rain.s1, rain.forceList); // find current net force on each particle
    rain.dotFinder(rain.s1dot, rain.s1); // find time-derivative s1dot from s1;
    rain.solver(); // find s2 from s1 & related states.
    // console.log(rain.isFountain);
    rain.doConstraints(rain.s1, rain.s2, rain.limitList, rain.amICrazy); // Apply all constraints.  s2 is ready!
    rain.render(); // transfer current state to VBO, set uniforms, draw it!
    rain.swap(); // Make s2 the new current state s1.s
    //===========================================
  
    // TORNADO
    tornado.switchToMe();
    tornado.adjust();
    tornado.applyForces(tornado.s1, tornado.forceList); // find current net force on each particle
    tornado.dotFinder(tornado.s1dot, tornado.s1); // find time-derivative s1dot from s1;
    tornado.solver(); // find s2 from s1 & related states.
    tornado.doConstraints(tornado.s1, tornado.s1dot, tornado.limitList, tornado.amICrazy); // Apply all constraints.  s2 is ready!
    tornado.render(); // transfer current state to VBO, set uniforms, draw it!
    tornado.swap(); // Make s2 the new current state s1.s
    //===========================================
  
    // SPRING PAIR
    springPair.switchToMe();
    springPair.adjust();
    springPair.applyForces(springPair.s1, springPair.forceList); // find current net force on each particle
    springPair.dotFinder(springPair.s1dot, springPair.s1); // find time-derivative s1dot from s1;
    springPair.solver(); // find s2 from s1 & related states.
    springPair.doConstraints(springPair.s1, springPair.s1dot, springPair.limitList, springPair.amICrazy); // Apply all constraints.  s2 is ready!
    springPair.render(); // transfer current state to VBO, set uniforms, draw it!
    springPair.swap(); // Make s2 the new current state s1.s
    //===========================================
  
    // SPRING ROPE
    springRope.switchToMe(); 
    springRope.adjust();
    springRope.applyForces(springRope.s1, springRope.forceList); // find current net force on each particle
    springRope.dotFinder(springRope.s1dot, springRope.s1); // find time-derivative s1dot from s1;
    springRope.solver(); // find s2 from s1 & related states.
    springRope.doConstraints(springRope.s1, springRope.s1dot, springRope.limitList, springRope.amICrazy); // Apply all constraints.  s2 is ready!
    springRope.render(); // transfer current state to VBO, set uniforms, draw it!
    springRope.swap(); // Make s2 the new current state s1.s
    //===========================================
  
    // SPRING ROPE
    boids.switchToMe(); 
    boids.adjust();
    boids.applyForces(boids.s1, boids.forceList); // find current net force on each particle
    boids.dotFinder(boids.s1dot, boids.s1); // find time-derivative s1dot from s1;
    boids.solver(); // find s2 from s1 & related states.
    boids.doConstraints(boids.s1, boids.s1dot, boids.limitList, boids.amICrazy); // Apply all constraints.  s2 is ready!
    boids.render(); // transfer current state to VBO, set uniforms, draw it!
    boids.swap(); // Make s2 the new current state s1.s
    //===========================================
    //===========================================
  } else {
    // runMode==0 (reset) or ==1 (pause): re-draw existing particles.
    //===========================================
    //===========================================
    
    // BOUNCYBALL 2D //! bring back
    // bouncyball2D.switchToMe();
    // bouncyball2D.adjust();
    // bouncyball2D.render();

    //==========================================
  
    // BOUNCYBALL 3D
    bouncyball3D.switchToMe();
    bouncyball3D.adjust();
    bouncyball3D.render();
    
    //==========================================
  
    // REEVES FIRE
    reevesFire.switchToMe();
    reevesFire.adjust();
    reevesFire.render();
    
    //==========================================
  
    // RAIN
    rain.switchToMe();
    rain.adjust();
    rain.render();
    
    //==========================================
  
    // TORNADO
    tornado.switchToMe();
    tornado.adjust();
    tornado.render();
    
    //===========================================
  
    // SPRING PAIR
    springPair.switchToMe();
    springPair.adjust();
    springPair.render();
    
    //===========================================
  
    // SPRING ROPE
    springRope.switchToMe();
    springRope.adjust();
    springRope.render();
    
    //===========================================
  
    // BOIDS
    boids.switchToMe();
    boids.adjust();
    boids.render();
    
    //===========================================
    //===========================================
  }
  // bouncyball.switchToMe();
  // bouncyball.adjust();
  // bouncyball.draw();

  //! How to use buttons
	if(g_show0 == 1) {	// IF user didn't press HTML button to 'hide' VBO0:
	  worldBox.switchToMe();  // Set WebGL to render from this VBObox.
		worldBox.adjust();		  // Send new values for uniforms to the GPU, and
		worldBox.draw();			  // draw our VBO's contents using our shaders.
  }
  if(g_show1 == 1) { // IF user didn't press HTML button to 'hide' VBO1:
    bouncyball3DBox.switchToMe();  // Set WebGL to render from this VBObox.
    bouncyball3DBox.adjust();		  // Send new values for uniforms to the GPU, and
    bouncyball3DBox.draw();			  // draw our VBO's contents using our shaders.
    }
  if(g_show1 == 1) { // IF user didn't press HTML button to 'hide' VBO1:
    reevesFireBox.switchToMe();  // Set WebGL to render from this VBObox.
    reevesFireBox.adjust();		  // Send new values for uniforms to the GPU, and
    reevesFireBox.draw();			  // draw our VBO's contents using our shaders.
    }
  if(g_show1 == 1) { // IF user didn't press HTML button to 'hide' VBO1:
    rainBox.switchToMe();  // Set WebGL to render from this VBObox.
    rainBox.adjust();		  // Send new values for uniforms to the GPU, and
    rainBox.draw();			  // draw our VBO's contents using our shaders.
    }
  if(g_show1 == 1) { // IF user didn't press HTML button to 'hide' VBO1:
    tornadoBox.switchToMe();  // Set WebGL to render from this VBObox.
  	tornadoBox.adjust();		  // Send new values for uniforms to the GPU, and
  	tornadoBox.draw();			  // draw our VBO's contents using our shaders.
	  }
  if(g_show1 == 1) { // IF user didn't press HTML button to 'hide' VBO1:
    springPairBox.switchToMe();  // Set WebGL to render from this VBObox.
  	springPairBox.adjust();		  // Send new values for uniforms to the GPU, and
  	springPairBox.draw();			  // draw our VBO's contents using our shaders.
	  }
  if(g_show1 == 1) { // IF user didn't press HTML button to 'hide' VBO1:
    springRopeBox.switchToMe();  // Set WebGL to render from this VBObox.
    springRopeBox.adjust();		  // Send new values for uniforms to the GPU, and
    springRopeBox.draw();			  // draw our VBO's contents using our shaders.
    }
  if(g_show1 == 1) { // IF user didn't press HTML button to 'hide' VBO1:
    boidsBox.switchToMe();  // Set WebGL to render from this VBObox.
    boidsBox.adjust();		  // Send new values for uniforms to the GPU, and
    boidsBox.draw();			  // draw our VBO's contents using our shaders.
    }
  // if(g_show1 == 1) { // IF user didn't press HTML button to 'hide' VBO1:
  //   fountainBox.switchToMe();  // Set WebGL to render from this VBObox.
  // 	fountainBox.adjust();		  // Send new values for uniforms to the GPU, and
  // 	fountainBox.draw();			  // draw our VBO's contents using our shaders.
	//   }
	// if(g_show2 == 1) { // IF user didn't press HTML button to 'hide' VBO2:
	//   phongBox.switchToMe();  // Set WebGL to render from this VBObox.
  // 	phongBox.adjust();		  // Send new values for uniforms to the GPU, and
  // 	phongBox.draw();			  // draw our VBO's contents using our shaders.
  // 	}
  
/* // ?How slow is our own code?  	
var aftrDraw = Date.now();
var drawWait = aftrDraw - b4Draw;
console.log("wait b4 draw: ", b4Wait, "drawWait: ", drawWait, "mSec");
*/
}

function VBO0toggle() {
//=============================================================================
// Called when user presses HTML-5 button 'Show/Hide VBO0'.
  if (g_show0 != 1) g_show0 = 1;
  // show,
  else g_show0 = 0; // hide.
  console.log("g_show0: " + g_show0);
}

function VBO1toggle() {
//=============================================================================
// Called when user presses HTML-5 button 'Show/Hide VBO1'.
  if (g_show1 != 1) g_show1 = 1;			
  // show,
  else g_show1 = 0; // hide.
  console.log("g_show1: " + g_show1);
}

function VBO2toggle() {
//=============================================================================
// Called when user presses HTML-5 button 'Show/Hide VBO2'.
  if (g_show2 != 1) g_show2 = 1;			
  // show,
  else g_show2 = 0; // hide.
  console.log("g_show2: " + g_show2);
}

function setCamera(initial) {
//============================================================================
// PLACEHOLDER:  sets a fixed camera at a fixed position for use by
// ALL VBObox objects.  REPLACE This with your own camera-control code.

	g_worldMat.setIdentity();
  
  viewWidth = g_canvasID.width; //Taken from Project B
  viewHeight = g_canvasID.height; //Taken from Project B

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
  // console.log('xdrag = ', xMdragTot);
  lookAtx = eyeAt[0] - Math.sin(theta);
  lookAty = eyeAt[1] + Math.cos(theta);
  lookAtz = eyeAt[2] + zDelta;

  // For this viewport, set camera's eye point and the viewing volume:
  //prettier-ignore
  g_worldMat.setPerspective( persFovy,  // fovy: y-axis field-of-view in degrees
                                        // (top <-> bottom in view frustum)
                            persAspect, // aspect ratio: width/height
                            zNear, zFar); // near, far (always >0).
  //prettier-ignore
  g_worldMat.lookAt(eyeAt[0], eyeAt[1], eyeAt[2], 				  // 'Center' or 'Eye Point',
                    lookAtx, lookAty, lookAtz, 					    // look-At point,
                    upVector[0], upVector[1], upVector[2]); // View UP vector, all in 'world' coords.

	// g_worldMat.perspective(42.0,   // FOVY: top-to-bottom vertical image angle, in degrees
  // 										1.0,   // Image Aspect Ratio: camera lens width/height
  //                     1.0,   // camera z-near distance (always positive; frustum begins at z = -znear)
  //                     200.0);  // camera z-far distance (always positive; frustum ends at z = -zfar)

  // g_worldMat.lookAt( 5.0, 5.0, 3.0,	// center of projection
  // 								 0.0, 0.0, 0.0,	// look-at point 
  // 								 0.0, 0.0, 1.0);	// View UP vector.
	// READY to draw in the 'world' coordinate system.
//------------END COPY
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
  var yp = g_canvasID.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
  //  console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);

  // Convert to Canonical View Volume (CVV) coordinates too:
  var x =
    (xp - g_canvasID.width / 2) / // move origin to center of canvas and
    (g_canvasID.width / 2); // normalize canvas to -1 <= x < +1,
  var y =
    (yp - g_canvasID.height / 2) / //										 -1 <= y < +1.
    (g_canvasID.height / 2);
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
  var yp = g_canvasID.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
  //  console.log('myMouseMove(pixel coords): xp,yp=\t',xp.toFixed(g_digits),',\t',yp.toFixed(g_digits));

  // Convert to Canonical View Volume (CVV) coordinates too:
  var x =
    (xp - g_canvasID.width / 2) / // move origin to center of canvas and
    (g_canvasID.width / 2); // normalize canvas to -1 <= x < +1,
  var y =
    (yp - g_canvasID.height / 2) / //										 -1 <= y < +1.
    (g_canvasID.height / 2);
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
  var yp = g_canvasID.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
  //  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);

  // Convert to Canonical View Volume (CVV) coordinates too:
  var x =
    (xp - g_canvasID.width / 2) / // move origin to center of canvas and
    (g_canvasID.width / 2); // normalize canvas to -1 <= x < +1,
  var y =
    (yp - g_canvasID.height / 2) / //										 -1 <= y < +1.
    (g_canvasID.height / 2);
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

// UNUSED
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

// UNUSED
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
  // g_timeStepMin = g_timeStep;
  // g_timeStepMax = g_timeStep;

  switch (kev.code) {
    // case "Digit0":
    //   bouncyball.runMode = 0; // RESET!
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() digit 0 key. Run Mode 0: RESET!"; // print on webpage,
    //   console.log("Run Mode 0: RESET!"); // print on console.
    //   break;
    // case "Digit1":
    //   bouncyball.runMode = 1; // PAUSE!
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() digit 1 key. Run Mode 1: PAUSE!"; // print on webpage,
    //   console.log("Run Mode 1: PAUSE!"); // print on console.
    //   break;
    // case "Digit2":
    //   bouncyball.runMode = 2; // STEP!
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() digit 2 key. Run Mode 2: STEP!"; // print on webpage,
    //   console.log("Run Mode 2: STEP!"); // print on console.
    //   break;
    // case "Digit3":
    //   bouncyball.runMode = 3; // RESET!
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() digit 3 key. Run Mode 3: RUN!"; // print on webpage,
    //   console.log("Run Mode 3: RUN!"); // print on console.
    //   break;
    // case "KeyB": // Toggle floor-bounce constraint type
    //   if (bouncyball.bounceType == 0) bouncyball.bounceType = 1;
    //   // impulsive vs simple
    //   else bouncyball.bounceType = 0;
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() b/B key: toggle bounce mode."; // print on webpage,
    //   console.log("b/B key: toggle bounce mode."); // print on console.
    //   break;
    // case "KeyC": // Toggle screen-clearing to show 'trails'
    //   g_isClear += 1;
    //   if (g_isClear > 1) g_isClear = 0;
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() c/C key: toggle screen clear."; // print on webpage,
    //   console.log("c/C: toggle screen-clear g_isClear:", g_isClear); // print on console,
    //   break;
    // case "KeyT": // 't'  INCREASE drag loss; 'T' to DECREASE drag loss
    //   if (kev.shiftKey == false) bouncyball.drag *= 0.995;
    //   // permit less movement.
    //   else {
    //     bouncyball.drag *= 1.0 / 0.995;
    //     if (bouncyball.drag > 1.0) bouncyball.drag = 1.0; // don't let drag ADD energy!
    //   }
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() t/T key: grow/shrink drag."; // print on webpage,
    //   console.log("t/T: grow/shrink drag:", bouncyball.drag); // print on console,
    //   break;
    // case "KeyF": // 'f' or 'F' to toggle particle fountain on/off
    //   bouncyball.isFountain += 1;
    //   if (bouncyball.isFountain > 1) bouncyball.isFountain = 0;
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() f/F key: toggle age constraint (fountain)."; // print on webpage,
    //   console.log("F: toggle age constraint (fountain)."); // print on console,
    //   break;
    // case "KeyG": // 'g' to REDUCE gravity; 'G' to increase.
    //   if (kev.shiftKey == false) bouncyball.grav *= 0.99;
    //   // shrink 1%
    //   else bouncyball.grav *= 1.0 / 0.98; // grow 2%
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() g/G key: shrink/grow gravity."; // print on webpage,
    //   console.log("g/G: shrink/grow gravity:", bouncyball.grav); // print on console,
    //   break;
    // case "KeyM": // 'm' to REDUCE mass; 'M' to increase.
    //   if (kev.shiftKey == false) bouncyball.mass *= 0.98;
    //   // shrink 2%
    //   else bouncyball.mass *= 1.0 / 0.98; // grow 2%
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() m/M key: shrink/grow mass."; // print on webpage,
    //   console.log("m/M: shrink/grow mass:", bouncyball.mass); // print on console,
    //   break;
    // case "KeyP":
    //   if (bouncyball.runMode == 3) bouncyball.runMode = 1;
    //   // if running, pause
    //   else bouncyball.runMode = 3; // if paused, run.
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() p/P key: toggle Pause/unPause!"; // print on webpage
    //   console.log("p/P key: toggle Pause/unPause!"); // print on console,
    //   break;
    case "KeyR": // r/R for RESET:
      if (kev.shiftKey == false) {
        // 'r' key: SOFT reset; boost velocity only
        bouncyball3D.runMode = 3; // RUN!
        var j = 0; // array index for particle i
        for (var i = 0; i < bouncyball3D.partCount; i += 1, j += PART_MAXVAR) {
          bouncyball3D.roundRand(); // make a spherical random var.
          if (bouncyball3D.s2[j + PART_XVEL] > 0.0)
            // ADD to positive velocity, and
            bouncyball3D.s2[j + PART_XVEL] +=
              1.7 + 0.4 * bouncyball3D.randX * bouncyball3D.INIT_VEL;
          // SUBTRACT from negative velocity:
          else
            bouncyball3D.s2[j + PART_XVEL] -=
              1.7 + 0.4 * bouncyball3D.randX * bouncyball3D.INIT_VEL;

          if (bouncyball3D.s2[j + PART_YVEL] > 0.0)
            bouncyball3D.s2[j + PART_YVEL] +=
              1.7 + 0.4 * bouncyball3D.randY * bouncyball3D.INIT_VEL;
          else
            bouncyball3D.s2[j + PART_YVEL] -=
              1.7 + 0.4 * bouncyball3D.randY * bouncyball3D.INIT_VEL;

          if (bouncyball3D.s2[j + PART_ZVEL] > 0.0)
            bouncyball3D.s2[j + PART_ZVEL] +=
              1.7 + 0.4 * bouncyball3D.randZ * bouncyball3D.INIT_VEL;
          else
            bouncyball3D.s2[j + PART_ZVEL] -=
              1.7 + 0.4 * bouncyball3D.randZ * bouncyball3D.INIT_VEL;
        }
      } else {
        // HARD reset: position AND velocity, BOTH state vectors:
        bouncyball3D.runMode = 0; // RESET!
        // Reset state vector s1 for ALL particles:
        var j = 0; // array index for particle i
        for (var i = 0; i < bouncyball3D.partCount; i += 1, j += PART_MAXVAR) {
          bouncyball3D.roundRand();
          bouncyball3D.s2[j + PART_XPOS] = -0.9; // lower-left corner of CVV
          bouncyball3D.s2[j + PART_YPOS] = -0.9; // with a 0.1 margin
          bouncyball3D.s2[j + PART_ZPOS] = 0.0;
          bouncyball3D.s2[j + PART_XVEL] =
            3.7 + 0.4 * bouncyball3D.randX * bouncyball3D.INIT_VEL;
          bouncyball3D.s2[j + PART_YVEL] =
            3.7 + 0.4 * bouncyball3D.randY * bouncyball3D.INIT_VEL; // initial velocity in meters/sec.
          bouncyball3D.s2[j + PART_ZVEL] =
            3.7 + 0.4 * bouncyball3D.randZ * bouncyball3D.INIT_VEL;
          // do state-vector s2 as well: just copy all elements of the float32array.
          bouncyball3D.s2.set(bouncyball3D.s1);
        } // end for loop
      } // end HARD reset
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() r/R key: soft/hard Reset."; // print on webpage,
      console.log("r/R: soft/hard Reset"); // print on console,
      break;
    case "KeyE":
      // Switch solver for bouncyball3D
      if (bouncyball3D.solvType == SOLV_MIDPOINT){
        bouncyball3D.solvType = SOLV_EULER;
        springPair.solvType = SOLV_EULER;
        document.getElementById("KeyDown").innerHTML =
          "myKeyDown() found e/E key. Switch solver to Euler!"; // print on webpage.
      } else if (bouncyball3D.solvType == SOLV_EULER){
        bouncyball3D.solvType = SOLV_OLDGOOD;
        springPair.solvType = SOLV_OLDGOOD;
        document.getElementById("KeyDown").innerHTML =
          "myKeyDown() found e/E key. Switch solver to the Original Bouncyabll solver"; // print on webpage.
      } else{
        bouncyball3D.solvType = SOLV_MIDPOINT;
        springPair.solvType = SOLV_MIDPOINT;
        document.getElementById("KeyDown").innerHTML =
          "myKeyDown() found e/E key. Switch solver to Midpoint!"; // print on webpage.
      } 
      // document.getElementById("KeyDown").innerHTML =
      //   "myKeyDown() found e/E key. Switch solvers!"; // print on webpage.
      console.log("e/E: Change Solver:", bouncyball3D.solvType); // print on console.
      
      // Switch solver for tornado
      // if (bouncyball3D.solvType == SOLV_EULER) bouncyball3D.solvType = SOLV_OLDGOOD;
      // else bouncyball3D.solvType = SOLV_EULER;
      // document.getElementById("KeyDown").innerHTML = 
      //   "myKeyDown() found e/E key. Switch solvers!"; // print on webpage.
      // console.log("e/E: Change Solver:", bouncyball3D.solvType); // print on console.
      break;
    case "KeyW":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found w/W key. Move FWD!  <br> Current Cords: (" + 
                                            eyeAt[0].toFixed(2) + "," + 
                                            eyeAt[1].toFixed(2) + "," + 
                                            eyeAt[2].toFixed(2) + ")"
        ;
      eyeAt[0] -= Math.sin(theta) * moveVelocity;
      eyeAt[1] += Math.cos(theta) * moveVelocity;
      eyeAt[2] += Math.sin(Math.atan(zDelta)) * moveVelocity;
      break;
    case "KeyA":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found a/A key. Strafe LEFT! <br> Current Cords: (" + 
                                              eyeAt[0].toFixed(2) + "," + 
                                              eyeAt[1].toFixed(2) + "," + 
                                              eyeAt[2].toFixed(2) + ")"
        ;
      eyeAt[0] -= Math.sin(theta + Math.PI / 2) * moveVelocity;
      eyeAt[1] += Math.cos(theta + Math.PI / 2) * moveVelocity;
      break;
    case "KeyS":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found s/Sa key. Move BACK.  <br> Current Cords: (" + 
                                              eyeAt[0].toFixed(2) + "," + 
                                              eyeAt[1].toFixed(2) + "," + 
                                              eyeAt[2].toFixed(2) + ")"
        ;
      eyeAt[0] += Math.sin(theta) * moveVelocity;
      eyeAt[1] -= Math.cos(theta) * moveVelocity;
      eyeAt[2] -= Math.sin(Math.atan(zDelta)) * moveVelocity;
      break;
    case "KeyD":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown() found d/D key. Strafe RIGHT!  <br> Current Cords: (" + 
                                                eyeAt[0].toFixed(2) + "," + 
                                                eyeAt[1].toFixed(2) + "," + 
                                                eyeAt[2].toFixed(2) + ")"
        ;
      eyeAt[0] += Math.sin(theta + Math.PI / 2) * moveVelocity;
      eyeAt[1] -= Math.cos(theta + Math.PI / 2) * moveVelocity;
      break;
    // case "Space":
    //   bouncyball.runMode = 2;
    //   document.getElementById("KeyDown").innerHTML =
    //     "myKeyDown() found Space key. Single-step!"; // print on webpage,
    //   console.log("SPACE bar: Single-step!"); // print on console.
    //   break;
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
      "myKeyDown(): Going UP!  <br> Current Cords: (" + 
                            eyeAt[0].toFixed(2) + "," + 
                            eyeAt[1].toFixed(2) + "," + 
                            eyeAt[2].toFixed(2) + ")"
                            ;
      eyeAt[2] += moveVelocity;
      console.log("Arrow-Up key: Going Up!");
      break;
    case "ArrowDown":
      document.getElementById("KeyDown").innerHTML =
        "myKeyDown(): Going DOWN!  <br> Current Cords: (" + 
                                eyeAt[0].toFixed(2) + "," + 
                                eyeAt[1].toFixed(2) + "," + 
                                eyeAt[2].toFixed(2) + ")"
                                ;
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