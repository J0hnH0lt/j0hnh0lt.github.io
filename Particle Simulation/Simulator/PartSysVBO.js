//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)

// Set 'tab' to 2 spaces (for best on-screen appearance)

/*
================================================================================
================================================================================

                              PartSysVBO Library

================================================================================
================================================================================
Prototype object that contains one complete particle system, including:
 -- state-variables s1, s2, & more that each describe a complete set of 
  particles at a fixed instant in time. Each state-var is a Float32Array that 
  hold the parameters of this.targCount particles (defined by constructor).
 -- Each particle is an identical sequence of floating-point parameters defined 
  by the extensible set of array-index names defined as constants near the top 
  of this file.  For example: PART_XPOS for x-coordinate of position, PART_YPOS 
  for particle's y-coord, and finally PART_MAXVAL defines total # of parameters.
  To access parameter PART_YVEL of the 17th particle in state var s1, use:
  this.s1[PART_YVEL + 17*PART_MAXVAL].
 -- A collection of 'force-causing' objects in forceList array
                                                  (see CForcer prototype below),
 -- A collection of 'constraint-imposing' objects in limitList array
                                                  (see CLimit prototype below),
 -- Particle-system computing functions described in class notes: 
  init(), applyForces(), dotFinder(), render(), doConstraints(), swap().
 
 HOW TO USE:
 ---------------
 a) Be sure your WebGL rendering context is available as the global var 'gl'.
 b) Create a global variable for each independent particle system:
  e.g.    g_PartA = new PartSysVBO(500);   // 500-particle fire-like system 
          g_partB = new PartSysVBO(32);    //  32-particle spring-mass system
          g_partC = new PartSysVBO(1024);  // 1024-particle smoke-like system
          ...
 c) Modify each particle-system as needed to get desired results:
    g_PartA.init(3);  g_PartA.solvType = SOLV_ADAMS_BASHFORTH; etc...
 d) Be sure your program's animation method (e.g. 'drawAll') calls the functions
    necessary for the simulation process of all particle systems, e.g.
      in main(), call g_partA.init(), g_partB.init(), g_partC.init(), ... etc
      in drawAll(), call:
        g_partA.applyForces(), g_partB.applyForces(), g_partC.applyForces(), ...
        g_partA.dotFinder(),   g_partB.dotFinder(),   g_partC.dotFinder(), ...
        g_partA.render(),      g_partB.render(),      g_partC.render(), ...
        g_partA.solver(),      g_partB.solver(),      g_partC.solver(), ...
        g_partA.doConstraint(),g_partB.doConstraint(),g_partC.doConstraint(),...
        g_partA.swap(),        g_partB.swap(),        g_partC.swap().

*/

// Array-name consts for all state-variables in PartSysVBO object:
/*------------------------------------------------------------------------------
     Each state-variable is a Float32Array object that holds 'this.partCount' 
particles. For each particle the state var holds exactly PART_MAXVAR elements 
(aka the 'parameters' of the particle) arranged in the sequence given by these 
array-name consts below.  
     For example, the state-variable object 'this.s1' is a Float32Array that 
holds this.partCount particles, and each particle is described by a sequence of
PART_MAXVAR floating-point parameters; in other words, the 'stride' that moves
use from a given parameter in one particle to the same parameter in the next
particle is PART_MAXVAR. Suppose we wish to find the Y velocity parameter of 
particle number 17 in s1 ('first' particle is number 0): we can
get that value if we write: this.s1[PART_XVEL + 17*PART_MAXVAR].
------------------------------------------------------------------------------*/
const PART_XPOS     = 0;  //  position    
const PART_YPOS     = 1;
const PART_ZPOS     = 2;
const PART_WPOS     = 3;            // (why include w? for matrix transforms; 
                                    // for vector/point distinction
const PART_XVEL     = 4;  //  velocity -- ALWAYS a vector: x,y,z; no w. (w==0)    
const PART_YVEL     = 5;
const PART_ZVEL     = 6;
const PART_X_FTOT   = 7;  // force accumulator:'ApplyForces()' fcn clears
const PART_Y_FTOT   = 8;  // to zero, then adds each force to each particle.
const PART_Z_FTOT   = 9;        
const PART_R        =10;  // color : red,green,blue, alpha (opacity); 0<=RGBA<=1.0
const PART_G        =11;  
const PART_B        =12;
const PART_LIFELEFT =13;
const PART_MASS     =14;  	// mass, in kilograms
const PART_DIAM 	  =15;	// on-screen diameter (in pixels)
const PART_RENDMODE =16;	// on-screen appearance (square, round, or soft-round)
 // Other useful particle values, currently unused
const PART_AGE      =17;  // # of frame-times until re-initializing (Reeves Fire)
/*
const PART_CHARGE   =17;  // for electrostatic repulsion/attraction
const PART_MASS_VEL =18;  // time-rate-of-change of mass.
const PART_MASS_FTOT=19;  // force-accumulator for mass-change
const PART_R_VEL    =20;  // time-rate-of-change of color:red
const PART_G_VEL    =21;  // time-rate-of-change of color:grn
const PART_B_VEL    =22;  // time-rate-of-change of color:blu
const PART_R_FTOT   =23;  // force-accumulator for color-change: red
const PART_G_FTOT   =24;  // force-accumulator for color-change: grn
const PART_B_FTOT   =25;  // force-accumulator for color-change: blu
*/
const PART_MAXVAR   =18;  // Size of array in CPart uses to store its values.


// Array-Name consts that select PartSysVBO objects' numerical-integration solver:
//------------------------------------------------------------------------------
// EXPLICIT methods: GOOD!
//    ++ simple, easy to understand, fast, but
//    -- Requires tiny time-steps for stable stiff systems, because
//    -- Errors tend to 'add energy' to any dynamical system, driving
//        many systems to instability even with small time-steps.
const SOLV_EULER       = 0;       // Euler integration: forward,explicit,...
const SOLV_MIDPOINT    = 1;       // Midpoint Method (see Pixar Tutorial)
const SOLV_ADAMS_BASH  = 2;       // Adams-Bashforth Explicit Integrator
const SOLV_RUNGEKUTTA  = 3;       // Arbitrary degree, set by 'solvDegree'

// IMPLICIT methods:  BETTER!
//          ++Permits larger time-steps for stiff systems, but
//          --More complicated, slower, less intuitively obvious,
//          ++Errors tend to 'remove energy' (ghost friction; 'damping') that
//              aids stability even for large time-steps.
//          --requires root-finding (iterative: often no analytical soln exists)
const SOLV_OLDGOOD     = 4;      //  early accidental 'good-but-wrong' solver
const SOLV_BACK_EULER  = 5;      // 'Backwind' or Implicit Euler
const SOLV_BACK_MIDPT  = 6;      // 'Backwind' or Implicit Midpoint
const SOLV_BACK_ADBASH = 7;      // 'Backwind' or Implicit Adams-Bashforth

// SEMI-IMPLICIT METHODS: BEST?
//          --Permits larger time-steps for stiff systems,
//          ++Simpler, easier-to-understand than Implicit methods
//          ++Errors tend to 'remove energy) (ghost friction; 'damping') that
//              aids stability even for large time-steps.
//          ++ DOES NOT require the root-finding of implicit methods,
const SOLV_VERLET      = 8;       // Verlet semi-implicit integrator;
const SOLV_VEL_VERLET  = 9;       // 'Velocity-Verlet'semi-implicit integrator
const SOLV_LEAPFROG    = 10;      // 'Leapfrog' integrator
const SOLV_MAX         = 11;      // number of solver types available.

const NU_EPSILON  = 10E-15;         // a tiny amount; a minimum vector length
                                    // to use to avoid 'divide-by-zero'

//=============================================================================
//==============================================================================
function PartSysVBO(_loc) {
//==============================================================================
//=============================================================================

//==============================================================================
// Vertex shader program:
  this.VERT_SRC =
    "precision mediump float;\n" + // req'd in OpenGL ES if we use 'float'
    //
    "uniform   int u_runMode; \n" + // particle system state:
    // 0=reset; 1= pause; 2=step; 3=run
    
    "attribute vec4 a_Position;\n" +
    "attribute float a_LifeLeft; \n" + // particle :

    "uniform   mat4 u_ModelMatrix;\n" +
    "varying   vec4 v_Color; \n" +
    "void main() {\n" +
    "  gl_PointSize = 15.0;\n" + // TRY MAKING THIS LARGER...
    // "	 gl_Position = a_Position; \n" +
    "	 gl_Position = u_ModelMatrix * a_Position; \n" +
    // Let u_runMode determine particle color:
    "  if(u_runMode == 0) { \n" +
    "    gl_PointSize = 15.0;\n" + // TRY MAKING THIS LARGER...
    "	   v_Color = vec4(1.0, 0.0, 0.0, 1.0);	\n" + // red: 0==reset
    "  	 } \n" +
    "  else if(u_runMode == 1) {  \n" +
    "    gl_PointSize = 15.0;\n" + // TRY MAKING THIS LARGER...
    "    v_Color = vec4(1.0, 1.0, 0.0, 1.0); \n" + // yellow: 1==pause
    "    }  \n" +
    "  else if(u_runMode == 2) { \n" +
    "    gl_PointSize = 15.0;\n" + // TRY MAKING THIS LARGER...
    "    v_Color = vec4(1.0, 1.0, 1.0, 1.0); \n" + // white: 2==step
    "    } \n" +
    "  else if(u_runMode == 4) { \n" +
    "    gl_PointSize = 15.0;\n" + // REEVES FIRE
    "    float normColor = a_LifeLeft / 20.0; \n" + 
    "    v_Color = vec4(1.0, normColor, 0.2, 1.0); \n" + // red shift
    "    } \n" +
    "  else if(u_runMode == 5) { \n" +
    "    gl_PointSize = 15.0;\n" + // BOIDS
    "    v_Color = vec4(0.5, 0.5, 0.5, 1.0); \n" + // gray
    "    } \n" +
    "  else if(u_runMode == 6) { \n" +
    "    gl_PointSize = 15.0;\n" + // RAIN
    "    float normColor = a_LifeLeft / 100.0; \n" + 
    "    v_Color = vec4(1.0 - normColor, 1.0 - normColor, 1.0, 1.0); \n" + // red shift
    "    } \n" +
    "  else { \n" +
    "    gl_PointSize = 17.0;\n" + 
    "    v_Color = vec4(0.2, 1.0, 0.2, 1.0); \n" + // green: >=3 ==run
    "		 } \n" +
    "} \n";
  // Each instance computes all the on-screen attributes for just one VERTEX,
  // supplied by 'attribute vec4' variable a_Position, filled from the
  // Vertex Buffer Object (VBO) created in g_partA.init().

//==============================================================================
// Fragment shader program:
  this.FRAG_SRC =
    "precision mediump float;\n" +
    "varying vec4 v_Color; \n" +
    "void main() {\n" +
    "  float dist = distance(gl_PointCoord, vec2(0.5, 0.5)); \n" +
    "  if(dist < 0.5) { \n" +
    "  	gl_FragColor = vec4((1.0-2.0*dist)*v_Color.rgb, 1.0);\n" +
    "  } else { discard; }\n" +
    "}\n";
// Constructor for a new particle system.
  this.randX = 0;   // random point chosen by call to roundRand()
  this.randY = 0;
  this.randZ = 0;
  this.isFountain = 0;  // Press 'f' or 'F' key to toggle; if 1, apply age 
                        // age constraint, which re-initializes particles whose
                        // lifetime falls to zero, forming a 'fountain' of
                        // freshly re-initialized bouncy-balls.
  this.forceList = [];            // (empty) array to hold CForcer objects
                                  // for use by ApplyAllForces().
                                  // NOTE: this.forceList.push("hello"); appends
                                  // string "Hello" as last element of forceList.
                                  // console.log(this.forceList[0]); prints hello.
  this.limitList = [];            // (empty) array to hold CLimit objects
                                  // for use by doContstraints()

  this.u_runModeID;
  // this.u_ageID; //! Ask jipeng for help
  this.shaderLoc;
  this.ModelMat = new Matrix4();
  this.u_ModelMatLoc

  this.loc = _loc;

  // console.log("Location: " + this.loc)
}
// HELPER FUNCTIONS:
//=====================
// Misc functions that don't fit elsewhere

PartSysVBO.prototype.roundRand = function() {
//==============================================================================
// When called, find a new 3D point (this.randX, this.randY, this.randZ) chosen 
// 'randomly' and 'uniformly' inside a sphere of radius 1.0 centered at origin.  
//		(within this sphere, all regions of equal volume are equally likely to
//		contain the the point (randX, randY, randZ, 1).

	do {			// RECALL: Math.random() gives #s with uniform PDF between 0 and 1.
		this.randX = 2.0*Math.random() -1.0; // choose an equally-likely 2D point
		this.randY = 2.0*Math.random() -1.0; // within the +/-1 cube, but
		this.randZ = 2.0*Math.random() -1.0;
		}       // is x,y,z outside sphere? try again!
	while(this.randX*this.randX + 
	      this.randY*this.randY + 
	      this.randZ*this.randZ >= 1.0); 
}

PartSysVBO.prototype.distance = function(point1, point2) {
  var x = point2[0] - point1[0];
  var y = point2[1] - point1[1];
  var z = point2[2] - point1[2];

  return Math.sqrt(x * x + y * y + z * z);
}

// INIT FUNCTIONS:
//==================
// Each 'init' function initializes everything in our particle system. Each 
// creates all necessary state variables, force-applying objects, 
// constraint-applying objects, solvers and all other values needed to prepare
// the particle-system to run without any further adjustments.

PartSysVBO.prototype.initBouncy2D = function(count) {
//==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = count;
  this.s1 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);  
        // NOTE: Float32Array objects are zero-filled by default.


        this.amICrazy = false;

  // Create & init all force-causing objects------------------------------------
  var fTmp = new CForcer();       // create a force-causing object, and
  // earth gravity for all particles:
  fTmp.forceType = F_GRAV_E;      // set it to earth gravity, and
  fTmp.targFirst = 0;             // set it to affect ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
                                  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
                                  // the forceList array of force-causing objects.
  // drag for all particles:
  fTmp = new CForcer();           // create a NEW CForcer object 
                                  // (WARNING! until we do this, fTmp refers to
                                  // the same memory locations as forceList[0]!!!) 
  fTmp.forceType = F_DRAG;        // Viscous Drag
  fTmp.Kdrag = 0.15;              // in Euler solver, scales velocity by 0.85
  fTmp.targFirst = 0;             // apply it to ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
                                  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
                                  // the forceList array of force-causing objects.
  // Report:
  console.log("PartSysVBO.initBouncy2D() created PartSysVBO.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for(i=0; i<this.forceList.length; i++) {
    console.log("CForceList[",i,"]");
    this.forceList[i].printMe();
    }                   

  // Create & init all constraint-causing objects-------------------------------
  var cTmp = new CLimit();      // creat constraint-causing object, and
  cTmp.hitType = HIT_BOUNCE_VEL;  // set how particles 'bounce' from its surface,
  cTmp.limitType = LIM_OLD;       // confine particles inside axis-aligned 
                                  // rectangular volume that
  cTmp.targFirst = 0;             // applies to ALL particles; starting at 0 
  cTmp.partCount = -1;            // through all the rest of them.
  cTmp.xMin = -1.0; cTmp.xMax = 1.0;  // box extent:  +/- 1.0 box at origin
  cTmp.yMin = -1.0; cTmp.yMax = 1.0;
  cTmp.zMin = -1.0; cTmp.zMax = 1.0;
  cTmp.Kresti = 1.0;              // bouncyness: coeff. of restitution.
                                  // (and IGNORE all other CLimit members...)
  this.limitList.push(cTmp);      // append this 'box' constraint object to the
                                  // 'limitList' array of constraint-causing objects.                                
  // Report:
  console.log("PartSysVBO.initBouncy2D() created PartSysVBO.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");

  this.INIT_VEL =  0.15 * 60.0;		// initial velocity in meters/sec.
	                  // adjust by ++Start, --Start buttons. Original value 
										// was 0.15 meters per timestep; multiply by 60 to get
                    // meters per second.
  this.drag = 0.985;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
	                  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
	                  // inelastic collisions.  Sets the fraction of momentum 
										// (0.0 <= resti < 1.0) that remains after a ball 
										// 'bounces' on a wall or floor, as computed using 
										// velocity perpendicular to the surface. 
										// (Recall: momentum==mass*velocity.  If ball mass does 
										// not change, and the ball bounces off the x==0 wall,
										// its x velocity xvel will change to -xvel * resti ).
										
  //--------------------------init Particle System Controls:
  this.runMode =  3;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_OLDGOOD;// adjust by s/S keys.
                    // SOLV_EULER (explicit, forward-time, as 
										// found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
										// SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
										// as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType = 1;	// floor-bounce constraint type:
										// ==0 for velocity-reversal, as in all previous versions
										// ==1 for Chapter 3's collision resolution method, which
										// uses an 'impulse' to cancel any velocity boost caused
										// by falling below the floor.
										
//--------------------------------Create & fill VBO with state var s1 contents:
// INITIALIZE s1, s2:
//  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
// That's OK for most particle parameters, but these need non-zero defaults:

  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    this.roundRand();       // set this.randX,randY,randZ to random location in 
                            // a 3D unit sphere centered at the origin.
    //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8) //! Spawn location
    this.s1[j + PART_XPOS] = -0.8 + 0.1*this.randX; 
    this.s1[j + PART_YPOS] = -0.8 + 0.1*this.randY;  
    this.s1[j + PART_ZPOS] = -0.8 + 0.1*this.randZ;
    this.s1[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.roundRand(); // Now choose random initial velocities too:
    this.s1[j + PART_XVEL] =  this.INIT_VEL*(0.4 + 0.2*this.randX);
    this.s1[j + PART_YVEL] =  this.INIT_VEL*(0.4 + 0.2*this.randY);
    this.s1[j + PART_ZVEL] =  this.INIT_VEL*(0.4 + 0.2*this.randZ);
    this.s1[j + PART_MASS] =  1.0;      // mass, in kg.
    this.s1[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
    this.s1[j + PART_LIFELEFT] = 10 + 10*Math.random();// 10 to 20
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 30 + 100*Math.random();
    //----------------------------
    this.s2.set(this.s1);   // COPY contents of state-vector s1 to s2.
  }

  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.

  // Set the initial values of all uniforms on GPU: (runMode set by keyboard)
	// gl.uniform1i(this.u_runModeID, this.runMode);
}

PartSysVBO.prototype.initBouncy3D = function(count) { 
  console.log("-------------- BOUNCY 3D ----------------")
//==============================================================================
//==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = count;
  this.s1 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);  
        // NOTE: Float32Array objects are zero-filled by default.

        this.amICrazy = false;

  // Create & init all force-causing objects------------------------------------
  var fTmp = new CForcer();       // create a force-causing object, and
  // earth gravity for all particles:
  fTmp.forceType = F_GRAV_E;      // set it to earth gravity, and
  fTmp.targFirst = 0;             // set it to affect ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
                                  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
                                  // the forceList array of force-causing objects.
  // drag for all particles:
  fTmp = new CForcer();           // create a NEW CForcer object 
                                  // (WARNING! until we do this, fTmp refers to
                                  // the same memory locations as forceList[0]!!!) 
  fTmp.forceType = F_DRAG;        // Viscous Drag
  fTmp.Kdrag = 0.9;              // in Euler solver, scales velocity by 0.85
  fTmp.targFirst = 0;             // apply it to ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
                                  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
                                  // the forceList array of force-causing objects.
  // Report:
  console.log("PartSysVBO.initBouncy3D() created PartSysVBO.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for(i=0; i<this.forceList.length; i++) {
    console.log("CForceList[",i,"]");
    this.forceList[i].printMe();
    }                   

  // Create & init all constraint-causing objects-------------------------------
  var cTmp = new CLimit();      // creat constraint-causing object, and
  cTmp.hitType = HIT_BOUNCE_VEL;  // set how particles 'bounce' from its surface,
  cTmp.limitType = LIM_OLD;       // confine particles inside axis-aligned 
                                  // rectangular volume that
  cTmp.targFirst = 0;             // applies to ALL particles; starting at 0 
  cTmp.partCount = -1;            // through all the rest of them.
  cTmp.xMin = -1.0; cTmp.xMax = 1.0;  // box extent:  +/- 1.0 box at origin
  cTmp.yMin = -1.0; cTmp.yMax = 1.0;
  cTmp.zMin = -1.0; cTmp.zMax = 1.0;
  cTmp.Kresti = 1.0;              // bouncyness: coeff. of restitution.
                                  // (and IGNORE all other CLimit members...)
  this.limitList.push(cTmp);      // append this 'box' constraint object to the
                                  // 'limitList' array of constraint-causing objects.                                
  // Report:
  console.log("PartSysVBO.initBouncy3D() created PartSysVBO.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");

  this.INIT_VEL =  0.15 * 60.0;		// initial velocity in meters/sec.
	                  // adjust by ++Start, --Start buttons. Original value 
										// was 0.15 meters per timestep; multiply by 60 to get
                    // meters per second.
  this.drag = 0.985;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
	                  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
	                  // inelastic collisions.  Sets the fraction of momentum 
										// (0.0 <= resti < 1.0) that remains after a ball 
										// 'bounces' on a wall or floor, as computed using 
										// velocity perpendicular to the surface. 
										// (Recall: momentum==mass*velocity.  If ball mass does 
										// not change, and the ball bounces off the x==0 wall,
										// its x velocity xvel will change to -xvel * resti ).
										
  //--------------------------init Particle System Controls:
  this.runMode =  3;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_MIDPOINT;// adjust by s/S keys.
                    // SOLV_EULER (explicit, forward-time, as 
										// found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
										// SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
										// as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType = 1;	// floor-bounce constraint type:
										// ==0 for velocity-reversal, as in all previous versions
										// ==1 for Chapter 3's collision resolution method, which
										// uses an 'impulse' to cancel any velocity boost caused
										// by falling below the floor.
										
//--------------------------------Create & fill VBO with state var s1 contents:
// INITIALIZE s1, s2:
//  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
// That's OK for most particle parameters, but these need non-zero defaults:

  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    this.roundRand();       // set this.randX,randY,randZ to random location in 
                            // a 3D unit sphere centered at the origin.
    //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8) //! Spawn location
    this.s1[j + PART_XPOS] = -0.8 + 0.1*this.randX; 
    this.s1[j + PART_YPOS] = -0.8 + 0.1*this.randY;  
    this.s1[j + PART_ZPOS] = -0.8 + 0.1*this.randZ;
    this.s1[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.roundRand(); // Now choose random initial velocities too:
    this.s1[j + PART_XVEL] =  this.INIT_VEL*(0.4 + 0.2*this.randX);
    this.s1[j + PART_YVEL] =  this.INIT_VEL*(0.4 + 0.2*this.randY);
    this.s1[j + PART_ZVEL] =  this.INIT_VEL*(0.4 + 0.2*this.randZ);
    this.s1[j + PART_MASS] =  1.0;      // mass, in kg.
    this.s1[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
    this.s1[j + PART_LIFELEFT] = 10 + 10*Math.random();// 10 to 20
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 30 + 100*Math.random();
    // this.s1[j + PART_AGE] = 1000000;

    // console.log("X pos: " + this.s1[j+ PART_XPOS] + " ||| X vel: " + this.s1[j + PART_XVEL]);
    // console.log("Y pos: " + this.s1[j+ PART_YPOS] + " ||| Y vel: " + this.s1[j + PART_YVEL]);
    // console.log("Z pos: " + this.s1[j+ PART_ZPOS] + " ||| Z vel: " + this.s1[j + PART_ZVEL]);
    //----------------------------
    this.s2.set(this.s1);   // COPY contents of state-vector s1 to s2.
  }

  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.

  // Set the initial values of all uniforms on GPU: (runMode set by keyboard)
	// gl.uniform1i(this.u_runModeID, this.runMode);
  // console.log('PartSysVBO.initBouncy3D() stub not finished!');
}

PartSysVBO.prototype.initFireReeves = function(count) {
  console.log("-------------- REEVES FIRE ----------------")
//==============================================================================
//==============================================================================
//==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = count;
  this.s1 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);  
        // NOTE: Float32Array objects are zero-filled by default.

  this.isFountain = 1;
  this.bounceType = 0;
  this.isFire = true;

  this.amICrazy = true; // Yes you are
  

  // Create & init all force-causing objects------------------------------------
  var fTmp = new CForcer();       // create a force-causing object, and
  // earth gravity for all particles:
  fTmp.forceType = F_GRAV_E;      // set it to earth gravity, and

  fTmp.targFirst = 0;             // set it to affect ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
                                  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
  //                                 // the forceList array of force-causing objects.
                                  
  // drag for all particles:
  var fTmp = new CForcer();           // create a NEW CForcer object 
                                  // (WARNING! until we do this, fTmp refers to
                                  // the same memory locations as forceList[0]!!!) 
  fTmp.forceType = F_DRAG;        // Viscous Drag
  fTmp.Kdrag = 0.15;              // in Euler solver, scales velocity by 0.85
  fTmp.targFirst = 0;             // apply it to ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
                                  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
                                  // the forceList array of force-causing objects.

  
  // -------------- WIND  for all particles:
  fTmp = new CForcer();              
  fTmp.forceType = F_WIND;    

  // fTmp.Kdrag = 0.15;              
  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   
  fTmp.windDir = [0, 0 , 1]; // Blow to the left
  fTmp.windStr = 7 ; // Strength of wind  

  this.forceList.push(fTmp);      // append this 'gravity' force object to 

  
  // Report:
  console.log("PartSysVBO.initFireReeves() created PartSysVBO.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for(i=0; i<this.forceList.length; i++) {
    console.log("CForceList[",i,"]");
    this.forceList[i].printMe();
    }                   

  // Create & init all constraint-causing objects-------------------------------
  var cTmp = new CLimit();      // creat constraint-causing object, and
  cTmp.hitType = HIT_BOUNCE_VEL;  // set how particles 'bounce' from its surface,
  cTmp.limitType = LIM_OLD;       // confine particles inside axis-aligned 
                                  // rectangular volume that
  cTmp.targFirst = 0;             // applies to ALL particles; starting at 0 
  cTmp.partCount = -1;            // through all the rest of them.
  cTmp.xMin = -1.0; cTmp.xMax = 1.0;  // box extent:  +/- 1.0 box at origin
  cTmp.yMin = -1.0; cTmp.yMax = 1.0;
  cTmp.zMin = -1.0; cTmp.zMax = 1.0;
  cTmp.Kresti = 1.0;              // bouncyness: coeff. of restitution.
                                  // (and IGNORE all other CLimit members...)
  this.limitList.push(cTmp);      // append this 'box' constraint object to the
                                  // 'limitList' array of constraint-causing objects.                                
  // Report:
  console.log("PartSysVBO.initBouncy3D() created PartSysVBO.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");

  this.INIT_VEL =  0.10 * 60.0;		// initial velocity in meters/sec.
  this.randomScalar = 0.3;
	                  // adjust by ++Start, --Start buttons. Original value 
										// was 0.15 meters per timestep; multiply by 60 to get
                    // meters per second.
  this.drag = 0.985;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
	                  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
	                  // inelastic collisions.  Sets the fraction of momentum 
										// (0.0 <= resti < 1.0) that remains after a ball 
										// 'bounces' on a wall or floor, as computed using 
										// velocity perpendicular to the surface. 
										// (Recall: momentum==mass*velocity.  If ball mass does 
										// not change, and the ball bounces off the x==0 wall,
										// its x velocity xvel will change to -xvel * resti ).
										
  //--------------------------init Particle System Controls:
  this.runMode =  4;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_MIDPOINT;// adjust by s/S keys.
                    // SOLV_EULER (explicit, forward-time, as 
										// found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
										// SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
										// as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType = 1;	// floor-bounce constraint type:
										// ==0 for velocity-reversal, as in all previous versions
										// ==1 for Chapter 3's collision resolution method, which
										// uses an 'impulse' to cancel any velocity boost caused
										// by falling below the floor.
										
//--------------------------------Create & fill VBO with state var s1 contents:
// INITIALIZE s1, s2:
//  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
// That's OK for most particle parameters, but these need non-zero defaults:

  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    this.roundRand();       // set this.randX,randY,randZ to random location in 
                            // a 3D unit sphere centered at the origin.
    //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8)
    // console.log("Made it")
    this.s2[j + PART_XPOS] = -0.0 + 0.2*this.randX; 
    this.s2[j + PART_YPOS] = -0.0 + 0.2*this.randY;  
    this.s2[j + PART_ZPOS] = -0.7 + 0.2*this.randZ;
    this.s2[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.roundRand(); // Now choose random initial velocities too:
    // this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + 0.2*this.randX);
    // this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.5 + 0.2*this.randY);
    this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randX);
    this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randY);
    this.s2[j + PART_ZVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randZ);
    this.s2[j + PART_MASS] =  1.0;      // mass, in kg.
    this.s2[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
    this.s2[j + PART_RENDMODE] = 0.0;
    this.s2[j + PART_AGE] = 3 + 1 * 10*Math.random();

    // this.s2[j + PART_R] = 1
    // this.s2[j + PART_G] = 1
    // this.s2[j + PART_B] = 1

    // console.log("X pos: " + this.s1[j+ PART_XPOS] + " ||| X vel: " + this.s1[j + PART_XVEL]);
    // console.log("Y pos: " + this.s1[j+ PART_YPOS] + " ||| Y vel: " + this.s1[j + PART_YVEL]);
    // console.log("Z pos: " + this.s1[j+ PART_ZPOS] + " ||| Z vel: " + this.s1[j + PART_ZVEL]);
    //----------------------------
    this.s2.set(this.s1);   // COPY contents of state-vector s1 to s2.
  }

  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.

  // Set the initial values of all uniforms on GPU: (runMode set by keyboard)
	// gl.uniform1i(this.u_runModeID, this.runMode);
 
  // console.log('PartSysVBO.initFireReeves() stub not finished!');
}

PartSysVBO.prototype.initRain = function(count) {
  console.log("-------------- RAIN ----------------")
//==============================================================================
//==============================================================================
//==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = count;
  this.s1 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);  
        // NOTE: Float32Array objects are zero-filled by default.

  this.isFountain = 1;
  this.bounceType = 0;
  this.isFire = false;

  this.amICrazy = true; // Yes you are
  

  // Create & init all force-causing objects------------------------------------
  var fTmp = new CForcer();       // create a force-causing object, and
  // earth gravity for all particles:
  fTmp.forceType = F_GRAV_E;      // set it to earth gravity, and

  fTmp.targFirst = 0;             // set it to affect ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
                                  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
  //                                 // the forceList array of force-causing objects.
                                  
  // drag for all particles:
  var fTmp = new CForcer();           // create a NEW CForcer object 
                                  // (WARNING! until we do this, fTmp refers to
                                  // the same memory locations as forceList[0]!!!) 
  fTmp.forceType = F_DRAG;        // Viscous Drag
  fTmp.Kdrag = 0.15;              // in Euler solver, scales velocity by 0.85
  fTmp.targFirst = 0;             // apply it to ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
                                  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
                                  // the forceList array of force-causing objects.

  
  // // -------------- WIND  for all particles:
  // fTmp = new CForcer();              
  // fTmp.forceType = F_WIND;    

  // // fTmp.Kdrag = 0.15;              
  // fTmp.targFirst = 0;             
  // fTmp.partCount = -1;   
  // fTmp.windDir = [0, 0 , 1]; // Blow to the left
  // fTmp.windStr = 7 ; // Strength of wind  

  // this.forceList.push(fTmp);      // append this 'gravity' force object to 

  
  // Report:
  console.log("PartSysVBO.initRain() created PartSysVBO.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for(i=0; i<this.forceList.length; i++) {
    console.log("CForceList[",i,"]");
    this.forceList[i].printMe();
    }                   

  // Create & init all constraint-causing objects-------------------------------
  var cTmp = new CLimit();      // creat constraint-causing object, and
  cTmp.hitType = HIT_BOUNCE_VEL;  // set how particles 'bounce' from its surface,
  cTmp.limitType = LIM_SPHERE;       
  
  cTmp.targFirst = 0;             
  cTmp.partCount = -1;     

  cTmp.spherePos = [0, 0, 0];
  cTmp.sphereRad = 0.5;

  this.limitList.push(cTmp);      

  // Report:
  console.log("PartSysVBO.initRain() created PartSysVBO.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");

  this.INIT_VEL =  0.10 * 60.0;		// initial velocity in meters/sec.
  this.randomScalar = 0.3;
	                  // adjust by ++Start, --Start buttons. Original value 
										// was 0.15 meters per timestep; multiply by 60 to get
                    // meters per second.
  this.drag = 0.985;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
	                  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
	                  // inelastic collisions.  Sets the fraction of momentum 
										// (0.0 <= resti < 1.0) that remains after a ball 
										// 'bounces' on a wall or floor, as computed using 
										// velocity perpendicular to the surface. 
										// (Recall: momentum==mass*velocity.  If ball mass does 
										// not change, and the ball bounces off the x==0 wall,
										// its x velocity xvel will change to -xvel * resti ).
										
  //--------------------------init Particle System Controls:
  this.runMode =  6;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_MIDPOINT;// adjust by s/S keys.
                    // SOLV_EULER (explicit, forward-time, as 
										// found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
										// SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
										// as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType = 1;	// floor-bounce constraint type:
										// ==0 for velocity-reversal, as in all previous versions
										// ==1 for Chapter 3's collision resolution method, which
										// uses an 'impulse' to cancel any velocity boost caused
										// by falling below the floor.
										
//--------------------------------Create & fill VBO with state var s1 contents:
// INITIALIZE s1, s2:
//  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
// That's OK for most particle parameters, but these need non-zero defaults:

  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    this.roundRand();       // set this.randX,randY,randZ to random location in 
                            // a 3D unit sphere centered at the origin.
    //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8)
    // console.log("Made it")
    this.s2[j + PART_XPOS] = -0.0 + 0.2*this.randX; 
    this.s2[j + PART_YPOS] = -0.0 + 0.2*this.randY;  
    this.s2[j + PART_ZPOS] = -0.7 + 0.2*this.randZ;
    this.s2[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.roundRand(); // Now choose random initial velocities too:
    // this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + 0.2*this.randX);
    // this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.5 + 0.2*this.randY);
    this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randX);
    this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randY);
    this.s2[j + PART_ZVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randZ);
    this.s2[j + PART_MASS] =  1.0;      // mass, in kg.
    this.s2[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
    this.s2[j + PART_RENDMODE] = 0.0;
    this.s2[j + PART_AGE] = 3 + 1 * 10*Math.random();

    // this.s2[j + PART_R] = 1
    // this.s2[j + PART_G] = 1
    // this.s2[j + PART_B] = 1

    // console.log("X pos: " + this.s1[j+ PART_XPOS] + " ||| X vel: " + this.s1[j + PART_XVEL]);
    // console.log("Y pos: " + this.s1[j+ PART_YPOS] + " ||| Y vel: " + this.s1[j + PART_YVEL]);
    // console.log("Z pos: " + this.s1[j+ PART_ZPOS] + " ||| Z vel: " + this.s1[j + PART_ZVEL]);
    //----------------------------
    this.s2.set(this.s1);   // COPY contents of state-vector s1 to s2.
  }

  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.

  // Set the initial values of all uniforms on GPU: (runMode set by keyboard)
	// gl.uniform1i(this.u_runModeID, this.runMode);
 
  // console.log('PartSysVBO.initFireReeves() stub not finished!');
}

PartSysVBO.prototype.initTornado = function(count) { 
  console.log("-------------- TORNADO ----------------")
//==============================================================================
//==============================================================================
//==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = count;
  this.s1 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);  

  this.amICrazy = false;

  // Create & init all force-causing objects------------------------------------
  // -------------- GRAVITY  for all particles:
  var fTmp = new CForcer();       

  fTmp.forceType = F_GRAV_E;      
  fTmp.targFirst = 0;             
  fTmp.partCount = -1;            

  this.forceList.push(fTmp);     

  // -------------- WIND  for all particles:
  fTmp = new CForcer();              
  fTmp.forceType = F_WIND;    

  // fTmp.Kdrag = 0.15;              
  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   
  fTmp.windDir = [0, 0, 1]; // Blow to the left
  fTmp.windStr = 9.8 ; // Strength of wind  
                                  
  this.forceList.push(fTmp);  
  
  // -------------- DRAG  for all particles:
  fTmp = new CForcer();              
  fTmp.forceType = F_DRAG;    

  fTmp.Kdrag = 0.15;              
  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  this.forceList.push(fTmp);  

  // -------------- SWIRL  for all particles:
  fTmp = new CForcer();              
  fTmp.forceType = F_SWIRL;    

  // fTmp.Kdrag = 0.15;              
  fTmp.targFirst = 0;             
  fTmp.partCount = -1; 

  fTmp.swirlCntr = [0, 0, 0];
  fTmp.swirlRad = 0.4;
  fTmp.swirlStr = 2;

  this.forceList.push(fTmp);    
  
  // -------------- BUBBLE  for all particles:
  fTmp = new CForcer();              
  fTmp.forceType = F_BUBBLE;    

  // fTmp.Kdrag = 0.15;              
  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.bub_radius = 1.2;
  fTmp.bub_ctr = [0, 0, 0];
  fTmp.bub_force = 2;
  fTmp.bub_influence = 10;

  this.forceList.push(fTmp); 
   
  // Report all added forces:
  console.log("\nPartSysVBO.initTornado() created PartSysVBO.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for(i=0; i<this.forceList.length; i++) {
    console.log("CForceList[",i,"]");
    this.forceList[i].printMe();
    }   
                  

  // Create & init all constraint-causing objects-------------------------------
  // Keep all particles inside box
  var cTmp = new CLimit();      
  cTmp.hitType = HIT_BOUNCE_VEL;  
  cTmp.limitType = LIM_OLD;        
                                  
  cTmp.targFirst = 0;              
  cTmp.partCount = -1;            
  cTmp.xMin = -1.0; cTmp.xMax = 1.0;  
  cTmp.yMin = -1.0; cTmp.yMax = 1.0;
  cTmp.zMin = -1.0; cTmp.zMax = 1.0;
  cTmp.Kresti = 1.0;              
                                  
  this.limitList.push(cTmp);      
                                                                  
  // Report all added constraints:
  console.log("PartSysVBO.initTornado() created PartSysVBO.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");
  
  //--------------------------init Particle System general:
  this.INIT_VEL =  0.15 * 60.0;		// initial velocity in meters/sec.
	                  // adjust by ++Start, --Start buttons. Original value 
										// was 0.15 meters per timestep; multiply by 60 to get
                    // meters per second.
  this.drag = 0.985;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
	                  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
	                  // inelastic collisions.  Sets the fraction of momentum 
										// (0.0 <= resti < 1.0) that remains after a ball 
										// 'bounces' on a wall or floor, as computed using 
										// velocity perpendicular to the surface. 
										// (Recall: momentum==mass*velocity.  If ball mass does 
										// not change, and the ball bounces off the x==0 wall,
										// its x velocity xvel will change to -xvel * resti ).
										
  //--------------------------init Particle System Controls:
  this.runMode =  3;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_MIDPOINT;// adjust by s/S keys.
                    // SOLV_EULER (explicit, forward-time, as 
										// found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
										// SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
										// as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType = 1;	// floor-bounce constraint type:
										// ==0 for velocity-reversal, as in all previous versions
										// ==1 for Chapter 3's collision resolution method, which
										// uses an 'impulse' to cancel any velocity boost caused
										// by falling below the floor.
										
//--------------------------------Create & fill VBO with state var s1 contents:
// INITIALIZE s1, s2:
//  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
// That's OK for most particle parameters, but these need non-zero defaults:

  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    this.roundRand();       // set this.randX,randY,randZ to random location in 
                            // a 3D unit sphere centered at the origin.
    //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8) //! Spawn location
    this.s1[j + PART_XPOS] = -0.8 + 0.1*this.randX; 
    this.s1[j + PART_YPOS] = -0.8 + 0.1*this.randY;  
    this.s1[j + PART_ZPOS] = -0.8 + 0.1*this.randZ;
    this.s1[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.roundRand(); // Now choose random initial velocities too:
    this.s1[j + PART_XVEL] =  this.INIT_VEL*(0.4 + 0.2*this.randX);
    this.s1[j + PART_YVEL] =  this.INIT_VEL*(0.4 + 0.2*this.randY);
    this.s1[j + PART_ZVEL] =  this.INIT_VEL*(0.4 + 0.2*this.randZ);
    this.s1[j + PART_MASS] =  1.0;      // mass, in kg.
    this.s1[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
    this.s1[j + PART_LIFELEFT] = 10 + 10*Math.random();// 10 to 20
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 30 + 100*Math.random();
    // this.s1[j + PART_AGE] = 1000000;

    this.s2.set(this.s1);   // COPY contents of state-vector s1 to s2.
  }

  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.
}
PartSysVBO.prototype.initFlocking = function(count) { 
  console.log("-------------- FLOCKING ----------------")
//==============================================================================
//==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = count;
  this.s1 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);  
        // NOTE: Float32Array objects are zero-filled by default.

  this.amICrazy = false;

  // Create & init all force-causing objects------------------------------------
  // -------------- BOID FORCES  for all particles:
  var fTmp = new CForcer();       

  fTmp.forceType = F_FLOCKING;     

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;           
  
  fTmp.avoidance = 0.01;
  fTmp.velMatching = 0.3;
  fTmp.centering = 0.3;
  fTmp.boidInf = 0.2;
  fTmp.personalSpace = 0.05;

  this.forceList.push(fTmp); 
  
  // // -------------- DRAG  for all particles:
  // fTmp = new CForcer();              
  // fTmp.forceType = F_DRAG;    

  // fTmp.Kdrag = 0.15;              
  // fTmp.targFirst = 0;             
  // fTmp.partCount = -1;   

  // this.forceList.push(fTmp);   

  // // -------------- BUBBLE  for all particles:
  // fTmp = new CForcer();              
  // fTmp.forceType = F_BUBBLE;    

  // // fTmp.Kdrag = 0.15;              
  // fTmp.targFirst = 0;             
  // fTmp.partCount = -1;   

  // fTmp.bub_radius = 1;
  // fTmp.bub_ctr = [0, 0, 0];
  // fTmp.bub_force = 2;
  // fTmp.bub_influence = 10;

  // this.forceList.push(fTmp);    


  // Report all added forces:
  console.log("PartSysVBO.initFlocking() created PartSysVBO.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for(i=0; i<this.forceList.length; i++) {
    console.log("CForceList[",i,"]");
    this.forceList[i].printMe();
    }                   


  // Create & init all constraint-causing objects-------------------------------
  // Keep all particles inside box
  var cTmp = new CLimit();      
  cTmp.hitType = HIT_BOUNCE_VEL;  
  cTmp.limitType = LIM_OLD_BOID;        
                                  
  cTmp.targFirst = 0;              
  cTmp.partCount = -1;            
  cTmp.xMin = -1.0; cTmp.xMax = 1.0;  
  cTmp.yMin = -1.0; cTmp.yMax = 1.0;
  cTmp.zMin = -1.0; cTmp.zMax = 1.0;
  cTmp.Kresti = 1.0;              
                                  
  this.limitList.push(cTmp);      
                                                                  
  // Report all added constraints:
  console.log("PartSysVBO.initFlocking() created PartSysVBO.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");

  this.INIT_VEL =  0.03 * 60.0;		// initial velocity in meters/sec.
	                  // adjust by ++Start, --Start buttons. Original value 
										// was 0.15 meters per timestep; multiply by 60 to get
                    // meters per second.
  this.drag = 1;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
	                  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
	                  // inelastic collisions.  Sets the fraction of momentum 
										// (0.0 <= resti < 1.0) that remains after a ball 
										// 'bounces' on a wall or floor, as computed using 
										// velocity perpendicular to the surface. 
										// (Recall: momentum==mass*velocity.  If ball mass does 
										// not change, and the ball bounces off the x==0 wall,
										// its x velocity xvel will change to -xvel * resti ).
										
  //--------------------------init Particle System Controls:
  this.runMode =  5;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_MIDPOINT;// adjust by s/S keys.
                    // SOLV_EULER (explicit, forward-time, as 
										// found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
										// SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
										// as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType = 2;	// floor-bounce constraint type:
										// ==0 for velocity-reversal, as in all previous versions
										// ==1 for Chapter 3's collision resolution method, which
										// uses an 'impulse' to cancel any velocity boost caused
										// by falling below the floor.
										
//--------------------------------Create & fill VBO with state var s1 contents:
// INITIALIZE s1, s2:
//  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
// That's OK for most particle parameters, but these need non-zero defaults:

  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    this.roundRand();       // set this.randX,randY,randZ to random location in 
                            // a 3D unit sphere centered at the origin.
    //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8) //! Spawn location
    this.s1[j + PART_XPOS] =  0.8*this.randX; 
    this.s1[j + PART_YPOS] =  0.8*this.randY;  
    this.s1[j + PART_ZPOS] =  0.8*this.randZ;
    this.s1[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.roundRand(); // Now choose random initial velocities too:
    this.s1[j + PART_XVEL] =  this.INIT_VEL*(0.6*this.randX);
    this.s1[j + PART_YVEL] =  this.INIT_VEL*(0.6*this.randY);
    this.s1[j + PART_ZVEL] =  this.INIT_VEL*(0.6*this.randZ);
    this.s1[j + PART_MASS] =  1.0;      // mass, in kg.
    this.s1[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
    this.s1[j + PART_LIFELEFT] = 10 + 10*Math.random();// 10 to 20
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 30 + 100*Math.random();
    // this.s1[j + PART_AGE] = 1000000;

    // console.log("X pos: " + this.s1[j+ PART_XPOS] + " ||| X vel: " + this.s1[j + PART_XVEL]);
    // console.log("Y pos: " + this.s1[j+ PART_YPOS] + " ||| Y vel: " + this.s1[j + PART_YVEL]);
    // console.log("Z pos: " + this.s1[j+ PART_ZPOS] + " ||| Z vel: " + this.s1[j + PART_ZVEL]);
    //----------------------------
    this.s2.set(this.s1);   // COPY contents of state-vector s1 to s2.
  }

  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.

  // Set the initial values of all uniforms on GPU: (runMode set by keyboard)
	// gl.uniform1i(this.u_runModeID, this.runMode);
  // console.log('PartSysVBO.initBouncy3D() stub not finished!');
//==============================================================================
  // console.log('PartSysVBO.initFlocking() stub not finished!');
}
PartSysVBO.prototype.initSpringPair = function() { 
  console.log("-------------- SPRING PAIR ----------------")
//==============================================================================
//==============================================================================
//==============================================================================
//==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = 2;
  this.s1 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);  

  this.drawLines = true; //! Need to adjust
  
  this.amICrazy = false;


  // Create & init all force-causing objects------------------------------------
  // -------------- GRAVITY  for all particles:
  // var fTmp = new CForcer();       

  // fTmp.forceType = F_GRAV_E;      
  // fTmp.targFirst = 0;             
  // fTmp.partCount = -1;            

  // this.forceList.push(fTmp);     

  // // -------------- WIND  for all particles:
  // fTmp = new CForcer();              
  // fTmp.forceType = F_WIND;    

  // // fTmp.Kdrag = 0.15;              
  // fTmp.targFirst = 0;             
  // fTmp.partCount = -1;   
  // fTmp.windDir = [0, 0, 1]; // Blow to the left
  // fTmp.windStr = 9.8 ; // Strength of wind  
                                  
  // this.forceList.push(fTmp);  
  
  // -------------- DRAG  for all particles:
  fTmp = new CForcer();              
  fTmp.forceType = F_DRAG;    

  fTmp.Kdrag = 0.15;              
  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  this.forceList.push(fTmp);  

  // -------------- SPRING  for all particles:
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 0;
  fTmp.e2 = 1;
  fTmp.K_spring = 1;
  fTmp.K_springDamp = 0.9;
  fTmp.K_restLength = 0.1;

  this.forceList.push(fTmp);  
   
  // Report all added forces:
  console.log("\nPartSysVBO.initSpringPair() created PartSysVBO.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for(i=0; i<this.forceList.length; i++) {
    console.log("CForceList[",i,"]");
    this.forceList[i].printMe();
    }   
                  

  // Create & init all constraint-causing objects-------------------------------
  // Keep all particles inside box
  var cTmp = new CLimit();      
  cTmp.hitType = HIT_BOUNCE_VEL;  
  cTmp.limitType = LIM_OLD;        
                                  
  cTmp.targFirst = 0;              
  cTmp.partCount = -1;            
  cTmp.xMin = -1.0; cTmp.xMax = 1.0;  
  cTmp.yMin = -1.0; cTmp.yMax = 1.0;
  cTmp.zMin = -1.0; cTmp.zMax = 1.0;
  cTmp.Kresti = 1.0;              
                                  
  this.limitList.push(cTmp);      
                                                                  
  // Report all added constraints:
  console.log("PartSysVBO.initSpringPair() created PartSysVBO.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");
  
  //--------------------------init Particle System general:
  this.INIT_VEL =  0.15 * 60.0;		// initial velocity in meters/sec.
	                  // adjust by ++Start, --Start buttons. Original value 
										// was 0.15 meters per timestep; multiply by 60 to get
                    // meters per second.
  this.drag = 0.985;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
	                  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
	                  // inelastic collisions.  Sets the fraction of momentum 
										// (0.0 <= resti < 1.0) that remains after a ball 
										// 'bounces' on a wall or floor, as computed using 
										// velocity perpendicular to the surface. 
										// (Recall: momentum==mass*velocity.  If ball mass does 
										// not change, and the ball bounces off the x==0 wall,
										// its x velocity xvel will change to -xvel * resti ).
										
  //--------------------------init Particle System Controls:
  this.runMode =  3;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_MIDPOINT;// adjust by s/S keys.
                    // SOLV_EULER (explicit, forward-time, as 
										// found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
										// SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
										// as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType = 1;	// floor-bounce constraint type:
										// ==0 for velocity-reversal, as in all previous versions
										// ==1 for Chapter 3's collision resolution method, which
										// uses an 'impulse' to cancel any velocity boost caused
										// by falling below the floor.
										
//--------------------------------Create & fill VBO with state var s1 contents:
// INITIALIZE s1, s2:
//  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
// That's OK for most particle parameters, but these need non-zero defaults:

  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    this.roundRand();       // set this.randX,randY,randZ to random location in 
                            // a 3D unit sphere centered at the origin.
//all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
// set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8) //! Spawn location
this.s1[j + PART_XPOS] = 0.7 * i; 
this.s1[j + PART_YPOS] = 0;  
this.s1[j + PART_ZPOS] = 0.5;
this.s1[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
this.roundRand(); // Now choose random initial velocities too:
this.s1[j + PART_XVEL] =  0;
this.s1[j + PART_YVEL] =  0;
this.s1[j + PART_ZVEL] =  0;
this.s1[j + PART_MASS] =  1.0;      // mass, in kg.
this.s1[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
this.s1[j + PART_LIFELEFT] = 10 + 10*Math.random();// 10 to 20
this.s1[j + PART_RENDMODE] = 0.0;
this.s1[j + PART_AGE] = 30 + 100*Math.random();
    // this.s1[j + PART_AGE] = 1000000;

    this.s2.set(this.s1);   // COPY contents of state-vector s1 to s2.
  }

  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.
  // console.log('PartSysVBO.initSpringPair() stub not finished!');
}
PartSysVBO.prototype.initSpringRope = function() { 
  console.log("-------------- SPRING ROPE ----------------")
//==============================================================================
//==============================================================================
//==============================================================================
//==============================================================================
//==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = 10; //! Change to handle given count of nodes
  this.s1 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 =    new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);  

  
  this.amICrazy = false;

  var my_spring =2;
  var my_springDamp = 0.9;
  var my_restLength = 0.1;
  this.drawLines = true; //! Need to adjust
  // Create & init all force-causing objects------------------------------------
  // -------------- GRAVITY  for all particles:
  // var fTmp = new CForcer();       

  // fTmp.forceType = F_GRAV_E;      
  // fTmp.targFirst = 0;             
  // fTmp.partCount = -1;            

  // this.forceList.push(fTmp);     

  // // -------------- WIND  for all particles:
  fTmp = new CForcer();              
  fTmp.forceType = F_WIND;    

  // fTmp.Kdrag = 0.15;              
  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   
  fTmp.windDir = [0, 0, -1]; // Blow to the left
  fTmp.windStr = 0.2 ; // Strength of wind  
                                  
  this.forceList.push(fTmp);  
  
  // -------------- DRAG  for all particles:
  fTmp = new CForcer();              
  fTmp.forceType = F_DRAG;    

  fTmp.Kdrag = 0.15;              
  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  this.forceList.push(fTmp);   

  // -------------- SPRING  for all particles: 0 - 1
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 0;
  fTmp.e2 = 1;
  fTmp.K_spring = my_spring;
  fTmp.K_springDamp = my_springDamp;
  fTmp.K_restLength = my_restLength

  this.forceList.push(fTmp);  

  // -------------- SPRING  for all particles: 1 - 2
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 1;
  fTmp.e2 = 2;
  fTmp.K_spring = my_spring;
  fTmp.K_springDamp = my_springDamp;
  fTmp.K_restLength = my_restLength

  this.forceList.push(fTmp);  

  // -------------- SPRING  for all particles: 2 - 3
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 2;
  fTmp.e2 = 3;
  fTmp.K_spring = my_spring;
  fTmp.K_springDamp = my_springDamp;
  fTmp.K_restLength = my_restLength

  this.forceList.push(fTmp);  

  // -------------- SPRING  for all particles: 3 - 4
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 3;
  fTmp.e2 = 4;
  fTmp.K_spring = my_spring;
  fTmp.K_springDamp = my_springDamp;
  fTmp.K_restLength = my_restLength

  this.forceList.push(fTmp);  

  // -------------- SPRING  for all particles: 4 - 5
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 4;
  fTmp.e2 = 5;
  fTmp.K_spring = my_spring;
  fTmp.K_springDamp = my_springDamp;
  fTmp.K_restLength = my_restLength

  this.forceList.push(fTmp);  

  // -------------- SPRING  for all particles: 5 - 6
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 5;
  fTmp.e2 = 6;
  fTmp.K_spring = my_spring;
  fTmp.K_springDamp = my_springDamp;
  fTmp.K_restLength = my_restLength

  this.forceList.push(fTmp);  

  // -------------- SPRING  for all particles: 6 - 7
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 6;
  fTmp.e2 = 7;
  fTmp.K_spring = my_spring;
  fTmp.K_springDamp = my_springDamp;
  fTmp.K_restLength = my_restLength

  this.forceList.push(fTmp);  

  // -------------- SPRING  for all particles: 7 - 8
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 7;
  fTmp.e2 = 8;
  fTmp.K_spring = my_spring;
  fTmp.K_springDamp = my_springDamp;
  fTmp.K_restLength = my_restLength

  this.forceList.push(fTmp);  

  // -------------- SPRING  for all particles: 8 - 9
  fTmp = new CForcer();              
  fTmp.forceType = F_SPRING;    

  fTmp.targFirst = 0;             
  fTmp.partCount = -1;   

  fTmp.e1 = 8;
  fTmp.e2 = 9; 
  fTmp.K_spring = my_spring;
  fTmp.K_springDamp = my_springDamp;
  fTmp.K_restLength = my_restLength

  this.forceList.push(fTmp);  
   
  // Report all added forces:
  console.log("\nPartSysVBO.initSpringRope() created PartSysVBO.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for(i=0; i<this.forceList.length; i++) {
    console.log("CForceList[",i,"]");
    this.forceList[i].printMe();
    }   
                  

  // Create & init all constraint-causing objects-------------------------------
  // Keep all particles inside box
  var cTmp = new CLimit();      
  cTmp.hitType = HIT_BOUNCE_VEL;  
  cTmp.limitType = LIM_OLD;        
                                  
  cTmp.targFirst = 1;              
  cTmp.partCount = -1;       

  cTmp.xMin = -1.0; cTmp.xMax = 1.0;  
  cTmp.yMin = -1.0; cTmp.yMax = 1.0;
  cTmp.zMin = -1.0; cTmp.zMax = 1.0;
  cTmp.Kresti = 1.0;              
                                  
  this.limitList.push(cTmp);      

  var cTmp = new CLimit();      
  cTmp.hitType = HIT_BOUNCE_VEL;  
  cTmp.limitType = LIM_ANCHOR;        
                                  
  cTmp.targFirst = 0;              
  cTmp.partCount = -1;     
          
  cTmp.anchor = 0;
  cTmp.anchorPos = [0.7, 0, 0.7];
                                  
  this.limitList.push(cTmp);     

  var cTmp = new CLimit();      
  cTmp.hitType = HIT_BOUNCE_VEL;  
  cTmp.limitType = LIM_ANCHOR;        
                                  
  cTmp.targFirst = 0;              
  cTmp.partCount = -1;     
          
  cTmp.anchor = 9;
  cTmp.anchorPos = [-0.7, 0, 0.7];
                                  
  this.limitList.push(cTmp);     
                                                                  
  // Report all added constraints:
  console.log("PartSysVBO.initSpringRope() created PartSysVBO.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");
  
  //--------------------------init Particle System general:
  this.INIT_VEL =  0;//0.15 * 60.0;		// initial velocity in meters/sec.
	                  // adjust by ++Start, --Start buttons. Original value 
										// was 0.15 meters per timestep; multiply by 60 to get
                    // meters per second.
  this.drag = 0.985;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
	                  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
	                  // inelastic collisions.  Sets the fraction of momentum 
										// (0.0 <= resti < 1.0) that remains after a ball 
										// 'bounces' on a wall or floor, as computed using 
										// velocity perpendicular to the surface. 
										// (Recall: momentum==mass*velocity.  If ball mass does 
										// not change, and the ball bounces off the x==0 wall,
										// its x velocity xvel will change to -xvel * resti ).
										
  //--------------------------init Particle System Controls:
  this.runMode =  3;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_MIDPOINT;// adjust by s/S keys.
                    // SOLV_EULER (explicit, forward-time, as 
										// found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
										// SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
										// as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType =1;	// floor-bounce constraint type:
										// ==0 for velocity-reversal, as in all previous versions
										// ==1 for Chapter 3's collision resolution method, which
										// uses an 'impulse' to cancel any velocity boost caused
										// by falling below the floor.
										
//--------------------------------Create & fill VBO with state var s1 contents:
// INITIALIZE s1, s2:
//  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
// That's OK for most particle parameters, but these need non-zero defaults:

  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    this.roundRand();       // set this.randX,randY,randZ to random location in 
                            // a 3D unit sphere centered at the origin.
    //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8) //! Spawn location
    this.s1[j + PART_XPOS] = 0.7 - 1.4 * (i / 9); 
    this.s1[j + PART_YPOS] = 0;  
    this.s1[j + PART_ZPOS] = 0.7;
    this.s1[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.roundRand(); // Now choose random initial velocities too:
    this.s1[j + PART_XVEL] =  0* this.INIT_VEL*(0.4 + 0.2*this.randX);
    this.s1[j + PART_YVEL] =  0* this.INIT_VEL*(0.4 + 0.2*this.randY);
    this.s1[j + PART_ZVEL] =  0* this.INIT_VEL*(0.4 + 0.2*this.randZ);
    this.s1[j + PART_MASS] =  1.0;      // mass, in kg.
    this.s1[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
    this.s1[j + PART_LIFELEFT] = 10 + 10*Math.random();// 10 to 20
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 30 + 100*Math.random();
    // this.s1[j + PART_AGE] = 1000000;

    this.s2.set(this.s1);   // COPY contents of state-vector s1 to s2.
  }

  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.
  // console.log('PartSysVBO.initSpringRope() stub not finished!');
}
PartSysVBO.prototype.initSpringCloth = function(xSiz,ySiz) {
//==============================================================================
  console.log('PartSysVBO.initSpringCloth() stub not finished!');
}
PartSysVBO.prototype.initSpringSolid = function() {
//==============================================================================
  console.log('PartSysVBO.initSpringSolid() stub not finished!');
}
PartSysVBO.prototype.initOrbits = function() {
//==============================================================================
  console.log('PartSysVBO.initOrbits() stub not finished!');
}

PartSysVBO.prototype.applyForces = function(s, fList) { 
//==============================================================================
// Clear the force-accumulator vector for each particle in state-vector 's', 
// then apply each force described in the collection of force-applying objects 
// found in 'fSet'.
// (this function will simplify our too-complicated 'draw()' function)

  // To begin, CLEAR force-accumulators for all particles in state variable 's'
  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    s[j + PART_X_FTOT] = 0.0;
    s[j + PART_Y_FTOT] = 0.0;
    s[j + PART_Z_FTOT] = 0.0;
  }
  // then find and accumulate all forces applied to particles in state s:
  for(var k = 0; k < fList.length; k++) {  // for every CForcer in fList array,
//    console.log("fList[k].forceType:", fList[k].forceType);
    if(fList[k].forceType <=0) {     //.................Invalid force? SKIP IT!
                        // if forceType is F_NONE, or if forceType was 
      continue;         // negated to (temporarily) disable the CForcer,
      }               
    // ..................................Set up loop for all targeted particles
    // HOW THIS WORKS:
    // Most, but not all CForcer objects apply a force to many particles, and
    // the CForcer members 'targFirst' and 'targCount' tell us which ones:
    // *IF* targCount == 0, the CForcer applies ONLY to particle numbers e1,e2
    //          (e.g. the e1 particle begins at s[fList[k].e1 * PART_MAXVAR])
    // *IF* targCount < 0, apply the CForcer to 'targFirst' and all the rest
    //      of the particles that follow it in the state variable s.
    // *IF* targCount > 0, apply the CForcer to exactly 'targCount' particles,
    //      starting with particle number 'targFirst'
    // Begin by presuming targCount < 0;
    var m = fList[k].targFirst;   // first affected particle # in our state 's'
    var mmax = this.partCount;    // Total number of particles in 's'
                                  // (last particle number we access is mmax-1)
    if(fList[k].targCount==0){    // ! Apply force to e1,e2 particles only!
      m=mmax=0;   // don't let loop run; apply force to e1,e2 particles only.
      }
    else if(fList[k].targCount > 0) {   // ?did CForcer say HOW MANY particles?
      // YES! force applies to 'targCount' particles starting with particle # m:
      var tmp = fList[k].targCount;
      if(tmp < mmax) mmax = tmp;    // (but MAKE SURE mmax doesn't get larger)
      else console.log("\n\n!!PartSysVBO.applyForces() index error!!\n\n");
      }
      //console.log("m:",m,"mmax:",mmax);
      // m and mmax are now correctly initialized; use them!  
    //......................................Apply force specified by forceType 
    switch(fList[k].forceType) {    // what kind of force should we apply?
      case F_MOUSE:     // Spring-like connection to mouse cursor
        console.log("PartSysVBO.applyForces(), fList[",k,"].forceType:", 
                                  fList[k].forceType, "NOT YET IMPLEMENTED!!");
        break;
      case F_GRAV_E:    // Earth-gravity pulls 'downwards' as defined by downDir
        var j = m*PART_MAXVAR;  // state var array index for particle # m
        for(; m<mmax; m++, j+=PART_MAXVAR) { // for every part# from m to mmax-1,
          //! OLD GRAV SYSTEM
                      // force from gravity == mass * gravConst * downDirection
          s[j + PART_X_FTOT] += s[j + PART_MASS] * fList[k].gravConst * 
                                                   fList[k].downDir.elements[0];
          s[j + PART_Y_FTOT] += s[j + PART_MASS] * fList[k].gravConst * 
                                                   fList[k].downDir.elements[1];
          s[j + PART_Z_FTOT] += s[j + PART_MASS] * fList[k].gravConst * 
                                                   fList[k].downDir.elements[2];
                
          //! Improvised             // force from gravity == mass * gravConst * downDirection
          // s[j + PART_XVEL] += s[j + PART_MASS] * fList[k].gravConst * (g_timeStep*0.001) *
          //                                          fList[k].downDir.elements[0];
          // s[j + PART_YVEL] += s[j + PART_MASS] * fList[k].gravConst * (g_timeStep*0.001) *
          //                                          fList[k].downDir.elements[1];
          // s[j + PART_ZVEL] += s[j + PART_MASS] * fList[k].gravConst * (g_timeStep*0.001) *
          //                                          fList[k].downDir.elements[2];
                                                   
          }
          
        break;
      case F_GRAV_P:    // planetary gravity between particle # e1 and e2.
        console.log("PartSysVBO.applyForces(), fList[",k,"].forceType:", 
                                  fList[k].forceType, "NOT YET IMPLEMENTED!!");
       break;
      case F_WIND:      // Blowing-wind-like force-field; fcn of 3D position
        var j = m*PART_MAXVAR;  // state var array index for particle # m

        for(; m<mmax; m++, j+=PART_MAXVAR) { // for every particle# from m to mmax-1,
                      // force from gravity == mass * gravConst * downDirection
          s[j + PART_X_FTOT] += fList[k].windStr * fList[k].windDir[0]; 
          s[j + PART_Y_FTOT] += fList[k].windStr * fList[k].windDir[1]; 
          s[j + PART_Z_FTOT] += fList[k].windStr * fList[k].windDir[2];
          }
        // console.log("It ran")
        break;
      case F_BUBBLE:    // Constant inward force (bub_force)to a 3D centerpoint 
                        // bub_ctr if particle is > bub_radius away from it.

        var j = m * PART_MAXVAR;
        for (; m < mmax; m++ , j += PART_MAXVAR) {

            var dirVec = new Vector3([fList[k].bub_ctr[0] - s[j + PART_XPOS],
                                      fList[k].bub_ctr[1] - s[j + PART_YPOS],
                                      fList[k].bub_ctr[2] - s[j + PART_ZPOS]]);
            // get unit vector
            dirVec.normalize();

            bubDist = this.distance(fList[k], [s[j + PART_XPOS], s[j + PART_YPOS], s[j + PART_ZPOS]]);

            if (bubDist >= fList[k].bub_radius && bubDist <= fList[k].bub_influence) {
                s[j + PART_X_FTOT] += dirVec.elements[0] * fList[k].bub_force;
                s[j + PART_Y_FTOT] += dirVec.elements[1] * fList[k].bub_force;
                s[j + PART_Z_FTOT] += dirVec.elements[2] * fList[k].bub_force;
            }
        }
        // console.log("PartSysVBO.applyForces(), fList[",k,"].forceType:", 
        //                           fList[k].forceType, "NOT YET IMPLEMENTED!!");
       break;
      case F_DRAG:      // viscous drag: force = -K_drag * velocity.
        var j = m*PART_MAXVAR;  // state var array index for particle # m

        for(; m<mmax; m++, j+=PART_MAXVAR) { // for every particle# from m to mmax-1,
                      // force from gravity == mass * gravConst * downDirection
          s[j + PART_X_FTOT] -= fList[k].K_drag * s[j + PART_XVEL]; 
          s[j + PART_Y_FTOT] -= fList[k].K_drag * s[j + PART_YVEL];
          s[j + PART_Z_FTOT] -= fList[k].K_drag * s[j + PART_ZVEL];
          }
        break;
      case F_SPRING:
          var e1Idx = fList[k].e1 * PART_MAXVAR;
          var e2Idx = fList[k].e2 * PART_MAXVAR;
          
    // console.log("X1 pos: " + s[e1Idx+ PART_XPOS] + " ||| X2 pos: " + s[e2Idx + PART_XPOS]);
    // console.log("Y1 pos: " + s[e1Idx+ PART_YPOS] + " ||| Y2 pos: " + s[e2Idx + PART_YPOS]);
    // console.log("Z1 pos: " + s[e1Idx+ PART_ZPOS] + " ||| Z2 pos: " + s[e2Idx + PART_ZPOS]);
    //----------------------------

          var relativeVel12 = new Vector3([s[e1Idx + PART_XVEL] - s[e2Idx + PART_XVEL],
                                           s[e1Idx + PART_YVEL] - s[e2Idx + PART_YVEL],
                                           s[e1Idx + PART_ZVEL] - s[e2Idx + PART_ZVEL]]);
          var dirVec12 = new Vector3([s[e1Idx + PART_XPOS] - s[e2Idx + PART_XPOS],
                                      s[e1Idx + PART_YPOS] - s[e2Idx + PART_YPOS],
                                      s[e1Idx + PART_ZPOS] - s[e2Idx + PART_ZPOS]]);

          var len = this.distance([s[e1Idx + PART_XPOS], s[e1Idx + PART_YPOS], s[e1Idx + PART_ZPOS]],
                                  [s[e2Idx + PART_XPOS], s[e2Idx + PART_YPOS], s[e2Idx + PART_ZPOS]]);
                                  
          var strechedLen = len - fList[k].K_restLength;

          relVelMag = relativeVel12.elements[0] * relativeVel12.elements[0] +
                      relativeVel12.elements[1] * relativeVel12.elements[1] +
                      relativeVel12.elements[2] * relativeVel12.elements[2];

          dirVec12.normalize();

          var springMag = fList[k].K_spring * strechedLen;
          
          //dot product of e12 normalized and e1 velocity
          //! Rain on top of a sphere (Dot product of the normal (subtact that from the veloicty All that is ledt is the tangent velocity))

          // relative velocity * dampling
          var damplingMag = -relVelMag * fList[k].K_springDamp;

          // console.log("springs ",fList[k].e1, "and", fList[k].e2," Spring: ", springMag, " Damping: ", damplingMag, " Relative Vel: ", relativeVel12.elements);
          s[e1Idx + PART_X_FTOT] -= dirVec12.elements[0] * (springMag + damplingMag);
          s[e1Idx + PART_Y_FTOT] -= dirVec12.elements[1] * (springMag + damplingMag);
          s[e1Idx + PART_Z_FTOT] -= dirVec12.elements[2] * (springMag + damplingMag);

          
          s[e2Idx + PART_X_FTOT] += dirVec12.elements[0] * (springMag + damplingMag);
          s[e2Idx + PART_Y_FTOT] += dirVec12.elements[1] * (springMag + damplingMag);
          s[e2Idx + PART_Z_FTOT] += dirVec12.elements[2] * (springMag + damplingMag);
        // }
        break;
      case F_SPRINGSET:
        console.log("PartSysVBO.applyForces(), fList[",k,"].forceType:", 
                                  fList[k].forceType, "NOT YET IMPLEMENTED!!");
        break;
      case F_CHARGE:
        console.log("PartSysVBO.applyForces(), fList[",k,"].forceType:", 
                                  fList[k].forceType, "NOT YET IMPLEMENTED!!");
        break;
      case F_FLOCKING:
        var i = m*PART_MAXVAR; 

        for(; m<mmax; m++, i+=PART_MAXVAR) { // For each i
          // find all j boids that will influence you
          for(var j = 0, n = 0; n<mmax; n++, j+=PART_MAXVAR) { // For each i
            // find all j boids that will influence you
            var dirMag = this.distance([s[i + PART_XPOS], s[i + PART_YPOS], s[i + PART_ZPOS]],
                                        [s[j + PART_XPOS], s[j + PART_YPOS], s[j + PART_ZPOS]]);
            
            if (n != m && dirMag <= fList[k].boidInf){
              // console.log(dirMag);
              // console.log("Check if conditional worked")
              // console.log("X1 pos: " + s[i+ PART_XPOS] + " ||| X2 pos: " + s[j + PART_XPOS]);
              // console.log("Y1 pos: " + s[i+ PART_YPOS] + " ||| Y2 pos: " + s[j + PART_YPOS]);
              // console.log("Z1 pos: " + s[i+ PART_ZPOS] + " ||| Z2 pos: " + s[j + PART_ZPOS]);
              
              var dirVecij = new Vector3([s[j + PART_XPOS] - s[i + PART_XPOS],
                                          s[j + PART_YPOS] - s[i + PART_YPOS],
                                          s[j + PART_ZPOS] - s[i + PART_ZPOS]]);
                                        
              var relVelij = new Vector3([s[j + PART_XVEL] - s[i + PART_XVEL],
                                          s[j + PART_YVEL] - s[i + PART_YVEL],
                                          s[j + PART_ZVEL] - s[i + PART_ZVEL]]);

              // console.log("particle ", m, " direction vec ", dirVecij)
              // var dist = this.distance
              // var dirMag = this.distance([s[i + PART_XPOS], s[i + PART_YPOS], s[i + PART_ZPOS]],
              //                            [s[j + PART_XPOS], s[j + PART_YPOS], s[j + PART_ZPOS]]);
              
              // dirVecij.normalize(); // Get x_ij <hat>

              if (dirMag < fList[k].personalSpace){
                
                // Third: Centering
                s[i + PART_XVEL] += fList[k].centering * dirVecij.elements[0]; 
                s[i + PART_YVEL] += fList[k].centering * dirVecij.elements[1];
                s[i + PART_ZVEL] += fList[k].centering * dirVecij.elements[2];

                dirVecij.normalize(); // Get x_ij <hat>

                // First: Collision Avoidance
                s[i + PART_XVEL] += -(fList[k].avoidance / dirMag) * dirVecij.elements[0]; 
                s[i + PART_YVEL] += -(fList[k].avoidance / dirMag) * dirVecij.elements[1];
                s[i + PART_ZVEL] += -(fList[k].avoidance / dirMag) * dirVecij.elements[2];

                // Second: Velocity Matching
                s[i + PART_XVEL] += fList[k].velMatching * relVelij.elements[0]; 
                s[i + PART_YVEL] += fList[k].velMatching * relVelij.elements[1];
                s[i + PART_ZVEL] += fList[k].velMatching * relVelij.elements[2];
                
                // // Third: Centering
                // s[i + PART_X_FTOT] += fList[k].centering * dirVecij.elements[0]; 
                // s[i + PART_Y_FTOT] += fList[k].centering * dirVecij.elements[1];
                // s[i + PART_Z_FTOT] += fList[k].centering * dirVecij.elements[2];

                // dirVecij.normalize(); // Get x_ij <hat>

                // // First: Collision Avoidance
                // s[i + PART_X_FTOT] += -(fList[k].avoidance / dirMag) * dirVecij.elements[0]; 
                // s[i + PART_Y_FTOT] += -(fList[k].avoidance / dirMag) * dirVecij.elements[1];
                // s[i + PART_Z_FTOT] += -(fList[k].avoidance / dirMag) * dirVecij.elements[2];

                // // Second: Velocity Matching
                // s[i + PART_X_FTOT] += fList[k].velMatching * relVelij.elements[0]; 
                // s[i + PART_Y_FTOT] += fList[k].velMatching * relVelij.elements[1];
                // s[i + PART_Z_FTOT] += fList[k].velMatching * relVelij.elements[2];


              } else if (fList[k].boidInf >= dirMag  && dirMag >= fList[k].personalSpace){
                
                distWeight = (fList[k].boidInf - dirMag) / (fList[k].boidInf - fList[k].personalSpace)
                
                // Third: Centering
                s[i + PART_XVEL] += fList[k].centering * dirVecij.elements[0] * distWeight; 
                s[i + PART_YVEL] += fList[k].centering * dirVecij.elements[1] * distWeight;
                s[i + PART_ZVEL] += fList[k].centering * dirVecij.elements[2] * distWeight;
                
                dirVecij.normalize(); // Get x_ij <hat>

                // First Collision Avoidance
                s[i + PART_XVEL] += -(fList[k].avoidance / dirMag) * dirVecij.elements[0] * distWeight; 
                s[i + PART_YVEL] += -(fList[k].avoidance / dirMag) * dirVecij.elements[1] * distWeight;
                s[i + PART_ZVEL] += -(fList[k].avoidance / dirMag) * dirVecij.elements[2] * distWeight;
            
                
                // Second Velocity Matching
                s[i + PART_XVEL] += fList[k].velMatching * relVelij.elements[0] * distWeight; 
                s[i + PART_YVEL] += fList[k].velMatching * relVelij.elements[1] * distWeight;
                s[i + PART_ZVEL] += fList[k].velMatching * relVelij.elements[2] * distWeight;

                
                // // Third: Centering
                // s[i + PART_X_FTOT] += fList[k].centering * dirVecij.elements[0] * distWeight; 
                // s[i + PART_Y_FTOT] += fList[k].centering * dirVecij.elements[1] * distWeight;
                // s[i + PART_Z_FTOT] += fList[k].centering * dirVecij.elements[2] * distWeight;
                
                // dirVecij.normalize(); // Get x_ij <hat>

                // // First Collision Avoidance
                // s[i + PART_X_FTOT] += -(fList[k].avoidance / dirMag) * dirVecij.elements[0] * distWeight; 
                // s[i + PART_Y_FTOT] += -(fList[k].avoidance / dirMag) * dirVecij.elements[1] * distWeight;
                // s[i + PART_Z_FTOT] += -(fList[k].avoidance / dirMag) * dirVecij.elements[2] * distWeight;
            
                
                // // Second Velocity Matching
                // s[i + PART_X_FTOT] += fList[k].velMatching * relVelij.elements[0] * distWeight; 
                // s[i + PART_Y_FTOT] += fList[k].velMatching * relVelij.elements[1] * distWeight;
                // s[i + PART_Z_FTOT] += fList[k].velMatching * relVelij.elements[2] * distWeight;

                
              }
            }
          }
          // s[j + PART_X_FTOT] -= fList[k].K_drag * s[j + PART_XVEL]; 
          // s[j + PART_Y_FTOT] -= fList[k].K_drag * s[j + PART_YVEL];
          // s[j + PART_Z_FTOT] -= fList[k].K_drag * s[j + PART_ZVEL];
        }
        // console.log("PartSysVBO.applyForces(), fList[",k,"].forceType:", 
        //                           fList[k].forceType, "NOT YET IMPLEMENTED!!");
        break;
      case F_SWIRL:
        
        var j = m * PART_MAXVAR;
        for (; m < mmax; m++ , j += PART_MAXVAR) {

          var upVec = new Vector3([0, 0, 1]);
          var dirVec = new Vector3([s[j + PART_XPOS]- fList[k].swirlCntr[0],
                                    s[j + PART_YPOS]- fList[k].swirlCntr[1],
                                    s[j + PART_ZPOS]- fList[k].swirlCntr[2]]);
          var fTotVec = upVec.cross(dirVec);

          var dist = this.distance([s[j + PART_XPOS], s[j + PART_YPOS], 0],
                                   [fList[k].swirlCntr[0], fList[k].swirlCntr[1], 0])

          s[j + PART_X_FTOT] += fTotVec.elements[0] * fList[k].swirlStr;
          s[j + PART_Y_FTOT] += fTotVec.elements[1] * fList[k].swirlStr;
          s[j + PART_Z_FTOT] += fTotVec.elements[2] * fList[k].swirlStr;
        }
        break;
      default:
        console.log("!!!ApplyForces() fList[",k,"] invalid forceType:", fList[k].forceType);
        break;
    } // switch(fList[k].forceType)
    
  // console.log("\n\nTHis is the force added", fList[k].forceType, " Totals ::", s[1 + PART_X_FTOT], 
  //                                                                              s[1 + PART_Y_FTOT], 
  //                                                                              s[1 + PART_Z_FTOT], "<<----\n\n");
  } // for(k=0...)
  
}
PartSysVBO.prototype.dotFinder = function(dest, src) {
//==============================================================================
// fill the already-existing 'dest' variable (a float32array) with the 
// time-derivative of given state 'src'.  

  var invMass;  // inverse mass
  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    dest[j + PART_XPOS] = src[j + PART_XVEL];   // position derivative = velocity
    dest[j + PART_YPOS] = src[j + PART_YVEL];
    dest[j + PART_ZPOS] = src[j + PART_ZVEL];
    // console.log(src[j + PART_ZVEL]);
    dest[j + PART_WPOS] = 0.0;                  // presume 'w' fixed at 1.0
    // Use 'src' current force-accumulator's values (set by PartSysVBO.applyForces())
    // to find acceleration.  As multiply is FAR faster than divide, do this:
    invMass = 1.0 / src[j + PART_MASS];   // F=ma, so a = F/m, or a = F(1/m);
    dest[j + PART_XVEL] = src[j + PART_X_FTOT] * invMass; 
    dest[j + PART_YVEL] = src[j + PART_Y_FTOT] * invMass;
    dest[j + PART_ZVEL] = src[j + PART_Z_FTOT] * invMass;
    dest[j + PART_X_FTOT] = 0.0;  // we don't know how force changes with time;
    dest[j + PART_Y_FTOT] = 0.0;  // presume it stays constant during timestep.
    dest[j + PART_Z_FTOT] = 0.0;
    dest[j + PART_R] = 0.0;       // presume color doesn't change with time.
    dest[j + PART_G] = 0.0;
    dest[j + PART_B] = 0.0;
    dest[j + PART_MASS] = 0.0;    // presume mass doesn't change with time.
    dest[j + PART_DIAM] = 0.0;    // presume these don't change either...   
    dest[j + PART_RENDMODE] = 0.0;
    dest[j + PART_AGE] = 0.0;
    }
}

PartSysVBO.prototype.render = function(s) {
  
  // this.reload();
  
  gl.bufferSubData(gl.ARRAY_BUFFER, 	// GLenum target(same as 'bindBuffer()')
  0,                  // byte offset to where data replacement
                      // begins in the VBO.
    this.s1);   // the JS source-data array used to fill VBO
  
  // check: was WebGL context set to use our VBO & shader program?
  if(this.isReady()==false) {
    console.log('ERROR! before' + this.constructor.name + 
          '.draw() call you needed to call this.switchToMe()!!');
  }

	gl.uniform1i(this.u_runModeID, this.runMode);	// run/step/pause the particle system 
	// gl.uniform1i(this.u_ageID, this.runMode);	// run/step/pause the particle system 

  // Draw our VBO's new contents:
  gl.drawArrays(gl.POINTS,          // mode: WebGL drawing primitive to use 
                0,                  // index: start at this vertex in the VBO;
                this.partCount);    // draw this many vertices.

  if (this.drawLines){
    // Draw our VBO's new contents:
    gl.drawArrays(gl.LINES,          // mode: WebGL drawing primitive to use 
      0,                  // index: start at this vertex in the VBO;
      this.partCount);    // draw this many vertices.

      // Draw our VBO's new contents:
      gl.drawArrays(gl.LINES,          // mode: WebGL drawing primitive to use 
        1,                  // index: start at this vertex in the VBO;
        this.partCount - 1);    // draw this many vertices.
  }
}

 PartSysVBO.prototype.solver = function() {
//==============================================================================
// Find next state s2 from current state s1 (and perhaps some related states
// such as s1dot, sM, sMdot, etc.) by the numerical integration method chosen
// by PartSysVBO.solvType.

		switch(this.solvType)
		{
		  case SOLV_EULER://--------------------------------------------------------
			// EXPLICIT or 'forward time' solver; Euler Method: s2 = s1 + h*s1dot
      for(var n = 0; n < this.s1.length; n++) { // for all elements in s1,s2,s1dot;
        this.s2[n] = this.s1[n] + this.s1dot[n] * (g_timeStep * 0.001); 
        }
/* // OLD 'BAD' solver never stops bouncing:
			// Compute new position from current position, current velocity, & timestep
      var j = 0;  // i==particle number; j==array index for i-th particle
      for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    			this.s2[j + PART_XPOS] += this.s2[j + PART_XVEL] * (g_timeStep * 0.001);
    			this.s2[j + PART_YPOS] += this.s2[j + PART_YVEL] * (g_timeStep * 0.001); 
    			this.s2[j + PART_ZPOS] += this.s2[j + PART_ZVEL] * (g_timeStep * 0.001); 
    			    			// -- apply acceleration due to gravity to current velocity:
    			// 					 s2[PART_YVEL] -= (accel. due to gravity)*(timestep in seconds) 
    			//									 -= (9.832 meters/sec^2) * (g_timeStep/1000.0);
    			this.s2[j + PART_YVEL] -= this.grav*(g_timeStep*0.001);
    			// -- apply drag: attenuate current velocity:
    			this.s2[j + PART_XVEL] *= this.drag;
    			this.s2[j + PART_YVEL] *= this.drag; 
    			this.s2[j + PART_ZVEL] *= this.drag; 
    	    }
*/
		  break;
		case SOLV_OLDGOOD://-------------------------------------------------------------------
			// IMPLICIT or 'reverse time' solver, as found in bouncyBall04.goodMKS;
			// This category of solver is often better, more stable, but lossy.
			// -- apply acceleration due to gravity to current velocity:
			//				  s2[PART_YVEL] -= (accel. due to gravity)*(g_timestep in seconds) 
			//                  -= (9.832 meters/sec^2) * (g_timeStep/1000.0);
      var j = 0;  // i==particle number; j==array index for i-th particle
      for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
  			this.s2[j + PART_ZVEL] -= this.grav*(g_timeStep*0.001);
  			// // -- apply drag: attenuate current velocity:
  			// this.s2[j + PART_XVEL] *= this.drag;
  			// this.s2[j + PART_YVEL] *= this.drag;
  			// this.s2[j + PART_ZVEL] *= this.drag;
  			// -- move our particle using current velocity:
  			// CAREFUL! must convert g_timeStep from milliseconds to seconds!
  			this.s2[j + PART_XPOS] += this.s2[j + PART_XVEL] * (g_timeStep * 0.001);
  			this.s2[j + PART_YPOS] += this.s2[j + PART_YVEL] * (g_timeStep * 0.001); 
  			this.s2[j + PART_ZPOS] += this.s2[j + PART_ZVEL] * (g_timeStep * 0.001); 
  		}
			// What's the result of this rearrangement?
			//	IT WORKS BEAUTIFULLY! much more stable much more often...
		  break;
    case SOLV_MIDPOINT:         // Midpoint Method (see lecture notes)
      //--------------------------------------------------------
      // create sM
      this.sM =    new Float32Array(this.partCount * PART_MAXVAR);

			// Half step: sM = s1 + (h/2)*s1dot
      for(var n = 0; n < this.s1.length; n++) { // for all elements in s1,s2,s1dot;
        this.sM[n] = this.s1[n] + .5 * this.s1dot[n] * (g_timeStep * 0.001); 
        }
      // turning s1dot into sMdot
      this.dotFinder(this.s1dot, this.sM);

      // Final update: s2 = s1 + h*sMdot
      for(var n = 0; n < this.s1.length; n++) { // for all elements in s1,s2,s1dot;
        this.s2[n] = this.s1[n] + this.s1dot[n] * (g_timeStep * 0.001); 
        }
      // console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_ADAMS_BASH:       // Adams-Bashforth Explicit Integrator
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_RUNGEKUTTA:       // Arbitrary degree, set by 'solvDegree'
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_BACK_EULER:       // 'Backwind' or Implicit Euler
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case  SOLV_BACK_MIDPT:      // 'Backwind' or Implicit Midpoint
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_BACK_ADBASH:      // 'Backwind' or Implicit Adams-Bashforth
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_VERLET:          // Verlet semi-implicit integrator;
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_VEL_VERLET:      // 'Velocity-Verlet'semi-implicit integrator
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_LEAPFROG:        // 'Leapfrog' integrator
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    default:
			console.log('?!?! unknown solver: this.solvType==' + this.solvType);
			break;
		}
		return;
}

PartSysVBO.prototype.doConstraints = function(sNow, sNext, cList, fountainTest) {
//==============================================================================
// apply all Climit constraint-causing objects in the cList array to the 
// particles/movements between current state sNow and future state sNext.

// 'bounce' our ball off floor & walls at +/- 0.9,+/-0.9, +/-0.9
// where this.bounceType selects constraint type:
// ==0 for simple velocity-reversal, as in all previous versions
// ==1 for textbook's collision resolution method, which uses an 'impulse' 
//          to cancel any velocity boost caused by falling below the floor.
//    

  for(var k = 0; k < cList.length; k++) {  // for every CLimit in cList array,
//    console.log("cList[k].limitType:", cList[k].limitType);
    if(cList[k].limitType <=0) {     //.................Invalid limit? SKIP IT!
                        // if limitType is LIM_NONE or if limitType was
      continue;         // negated to (temporarily) disable the CLimit object,
      }                 // skip this k-th object in the cList[] array.
    // ..................................Set up loop for all targeted particles
    // HOW THIS WORKS:
    // Most, but not all CLimit objects apply constraint to many particles, and
    // the CLimit members 'targFirst' and 'targCount' tell us which ones:
    // *IF* targCount == 0, the CLimit applies ONLY to particle numbers e1,e2
    //          (e.g. the e1 particle begins at sNow[fList[k].e1 * PART_MAXVAR])
    // *IF* targCount < 0, apply the CLimit to 'targFirst' and all the rest
    //      of the particles that follow it in the state variables sNow, sNext.
    // *IF* targCount > 0, apply the CForcer to exactly 'targCount' particles,
    //      starting with particle number 'targFirst'
    // Begin by presuming targCount < 0;
    var m = cList[k].targFirst;    // first targed particle # in the state vars
    var mmax = this.partCount;    // total number of particles in the state vars
                                  // (last particle number we access is mmax-1)
    if(cList[k].targCount==0){    // ! Apply CLimit to e1,e2 particles only!
      m=mmax=0;   // don't let loop run; apply CLimit to e1,e2 particles only.
      }
    else if(cList[k].targCount > 0) {   // ?did CLimit say HOW MANY particles?
      // YES! limit applies to 'targCount' particles starting with particle # m:
      var tmp = cList[k].targCount;
      if(tmp < mmax) mmax = tmp; // (but MAKE SURE mmax doesn't get larger)
      else console.log("\n\n!!PartSysVBO.doConstraints() index error!!\n\n");
      }
      //console.log("m:",m,"mmax:",mmax);
      // m and mmax are now correctly initialized; use them!  
    //......................................Apply limit specified by limitType 
    switch(cList[k].limitType) {    // what kind of limit should we apply?
      case LIM_VOL:     // The axis-aligned rectangular volume specified by
                        // cList[k].xMin,xMax,yMin,yMax,zMin,zMax keeps
                        // particles INSIDE if xMin<xMax, yMin<yMax, zMin<zMax
                        //      and OUTSIDE if xMin>xMax, yMin>yMax, zMin>xMax.
        var j = m*PART_MAXVAR;  // state var array index for particle # m

       for(; m<mmax; m++, j+=PART_MAXVAR) { // for every part# from m to mmax-1,
         sNext[j + PART_X_FTOT] += sNow[j + PART_MASS] * fList[k].gravConst * 
                                                  fList[k].downDir.elements[0];
         sNext[j + PART_Y_FTOT] += sNow[j + PART_MASS] * fList[k].gravConst * 
                                                  fList[k].downDir.elements[1];
         sNext[j + PART_Z_FTOT] += s[j + PART_MASS] * fList[k].gravConst * 
                                                  fList[k].downDir.elements[2];
         }
        break;
      case LIM_WALL:    // 2-sided wall: rectangular, axis-aligned, flat/2D,
                        // zero thickness, any desired size & position
        break;
      case LIM_DISC:    // 2-sided ellipsoidal wall, axis-aligned, flat/2D,
                        // zero thickness, any desired size & position
        break;
      case LIM_BOX:
        break;
      case LIM_SPHERE:
        var j = m*PART_MAXVAR;  // state var array index for particle # m

        for(; m<mmax; m++, j+=PART_MAXVAR) { // for every part# from m to mmax-1,
            var s2Pos = new Vector3([this.s2[j + PART_XPOS], 
                                     this.s2[j + PART_YPOS],
                                     this.s2[j + PART_ZPOS]]);
            if (this.distance(s2Pos.elements, cList[k].spherePos) < cList[k].sphereRad)
            {
              var normal = new Vector3([s2Pos.elements[0] - cList[k].spherePos[0],
                                        s2Pos.elements[1] - cList[k].spherePos[1],
                                        s2Pos.elements[2] - cList[k].spherePos[2]]);
              var dot = normal.dot(s2Pos);

              this.s2[j + PART_XVEL] = normal.elements[0] * dot;
              this.s2[j + PART_YVEL] = normal.elements[1] * dot;
              this.s2[j + PART_ZVEL] = normal.elements[2] * dot;
              
            }
          }
          
          // particle age                  
          var j = 0; 
          for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
  
            if (this.isFountain == 1){
            this.s2[j + PART_AGE] -= 1;     // decrement lifetime.
            }

            // if(this.s2[j + PART_AGE] <= 0) { // End of life: RESET this particle!
            if(this.s2[j + PART_AGE] <= 0 || this.s2[j + PART_ZPOS] <= -2) { // End of life: RESET this particle!
              if(this.isFire){
                { // End of life: RESET this particle!
                  this.roundRand();       
                  this.s2[j + PART_XPOS] = -0.0 + 0.2*this.randX; 
                  this.s2[j + PART_YPOS] = -0.0 + 0.2*this.randY;  
                  this.s2[j + PART_ZPOS] = -0.7 + 0.2*this.randZ;
                  this.s2[j + PART_WPOS] =  1.0;      
                  this.roundRand(); 
                  this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randX);
                  this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randY);
                  this.s2[j + PART_ZVEL] =  this.INIT_VEL*(0.5 + this.randomScalar*this.randZ);
                  this.s2[j + PART_MASS] =  1.0;      // mass, in kg.
                  this.s2[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
                  this.s2[j + PART_RENDMODE] = 0.0;
                  this.s2[j + PART_AGE] = 15 + 10*Math.random();
                  }
              } else if (!this.isFire){
                { // End of life: RESET this particle!
                  this.roundRand(); 
                  this.s2[j + PART_XPOS] = 0.8*this.randX; 
                  this.s2[j + PART_YPOS] = 0.8*this.randY;  
                  this.s2[j + PART_ZPOS] = 0.7 + 0.2*this.randZ;
                  this.s2[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
                  this.roundRand(); 
                  this.s2[j + PART_XVEL] =  0 *this.INIT_VEL*(0.1 + this.randomScalar*this.randX);
                  this.s2[j + PART_YVEL] =  0* this.INIT_VEL*(0.1 + this.randomScalar*this.randY);
                  this.s2[j + PART_ZVEL] =  0;
                  // this.s2[j + PART_ZVEL] =  this.INIT_VEL*(0.5 + this.randomScalar*this.randZ);
                  this.s2[j + PART_MASS] =  1.0;      // mass, in kg.
                  this.s2[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
                  this.s2[j + PART_RENDMODE] = 0.0;
                  this.s2[j + PART_AGE] = 150 + 100*Math.random();
                  }
              }
            } // if age <=0
          } // for loop thru all particles   
  
          break;
      case LIM_MAT_WALL:
        break;
      case LIM_MAT_DISC:
        break;   
      case LIM_ANCHOR:
        var anchorIdx =  cList[k].anchor * PART_MAXVAR;
        this.s2[anchorIdx + PART_XPOS] = cList[k].anchorPos[0];
        this.s2[anchorIdx + PART_YPOS] = cList[k].anchorPos[1];
        this.s2[anchorIdx + PART_ZPOS] = cList[k].anchorPos[2];

        this.s2[anchorIdx + PART_XVEL] = 0;
        this.s2[anchorIdx + PART_YVEL] = 0;
        this.s2[anchorIdx + PART_ZVEL] = 0;
        break;
      case LIM_OLD:             
        if(this.bounceType==0) { //------------------------------------------------
          var j = 0;  // i==particle number; j==array index for i-th particle
          for(var i = m; i < mmax; i += 1, j+= PART_MAXVAR) {
            // simple velocity-reversal: 
            if(      this.s2[j + PART_XPOS] < -0.9 && this.s2[j + PART_XVEL] < 0.0) { 
              // bounce on left (-X) wall
              this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; 
            }
            else if( this.s2[j + PART_XPOS] >  0.9 && this.s2[j + PART_XVEL] > 0.0) {		
              // bounce on right (+X) wall
              this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL];
            } //---------------------------
            if(      this.s2[j + PART_YPOS] < -0.9 && this.s2[j + PART_YVEL] < 0.0) {
              // bounce on floor (-Y)
              this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL];
            }
            else if( this.s2[j + PART_YPOS] >  0.9 && this.s2[j + PART_YVEL] > 0.0) {		
              // bounce on ceiling (+Y)
              this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL];
            } //---------------------------
            if(      this.s2[j + PART_ZPOS] < -0.9 && this.s2[j + PART_ZVEL] < 0.0) {
              // bounce on near wall (-Z)
              this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL];
            }
            else if( this.s2[j + PART_ZPOS] >  0.9 && this.s2[j + PART_ZVEL] > 0.0) {		
              // bounce on far wall (+Z)
              this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL];
              }	
          //--------------------------
          // The above constraints change ONLY the velocity; nothing explicitly
          // forces the bouncy-ball to stay within the walls. If we begin with a
          // bouncy-ball on floor with zero velocity, gravity will cause it to 'fall' 
          // through the floor during the next timestep.  At the end of that timestep
          // our velocity-only constraint will scale velocity by -this.resti, but its
          // position is still below the floor!  Worse, the resti-weakened upward 
          // velocity will get cancelled by the new downward velocity added by gravity 
          // during the NEXT time-step. This gives the ball a net downwards velocity 
          // again, which again gets multiplied by -this.resti to make a slight upwards
          // velocity, but with the ball even further below the floor. As this cycle
          // repeats, the ball slowly sinks further and further downwards.
          // THUS the floor needs this position-enforcing constraint as well:
            if(      this.s2[j + PART_YPOS] < -0.9) this.s2[j + PART_YPOS] = -0.9;
            else if( this.s2[j + PART_YPOS] >  0.9) this.s2[j + PART_YPOS] =  0.9; // ceiling
            if(      this.s2[j + PART_XPOS] < -0.9) this.s2[j + PART_XPOS] = -0.9; // left wall
            else if( this.s2[j + PART_XPOS] >  0.9) this.s2[j + PART_XPOS] =  0.9; // right wall
            if(      this.s2[j + PART_ZPOS] < -0.9) this.s2[j + PART_ZPOS] = -0.9; // near wall
            else if( this.s2[j + PART_ZPOS] >  0.9) this.s2[j + PART_ZPOS] =  0.9; // far wall
          // Our simple 'bouncy-ball' particle system needs this position-limiting
          // constraint ONLY for the floor and not the walls, as no forces exist that
          // could 'push' a zero-velocity particle against the wall. But suppose we
          // have a 'blowing wind' force that pushes particles left or right? Any
          // particle that comes to rest against our left or right wall could be
          // slowly 'pushed' through that wall as well -- THUS we need position-limiting
          // constraints for ALL the walls:
          } // end of for-loop thru all particles
        } // end of 'if' for bounceType==0
        else if (this.bounceType==1) { 
        //-----------------------------------------------------------------
          var j = 0;  // i==particle number; j==array index for i-th particle
          for(var i = m; i < mmax; i += 1, j+= PART_MAXVAR) {
            //--------  left (-X) wall  ----------
            if( this.s2[j + PART_XPOS] < -0.9) {// && this.s2[j + PART_XVEL] < 0.0 ) {
            // collision!
              this.s2[j + PART_XPOS] = this.s1[j + PART_XPOS];// 1) resolve contact: put particle at wall.
              this.s2[j + PART_XVEL] = this.s1[j + PART_XVEL];  // 2a) undo velocity change:
              this.s2[j + PART_XVEL] *= this.drag;	            // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE!
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision. 
              if( this.s2[j + PART_XVEL] < 0.0) 
                  this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_XVEL] =  this.resti * this.s2[j + PART_XVEL]; // sign changed-- don't need another.
            }
            //--------  right (+X) wall  --------------------------------------------
            else if( this.s2[j + PART_XPOS] >  0.9) { // && this.s2[j + PART_XVEL] > 0.0) {	
            // collision!
              this.s2[j + PART_XPOS] = this.s1[j + PART_XPOS]; // 1) resolve contact: put particle at wall.
              this.s2[j + PART_XVEL] = this.s1[j + PART_XVEL];	// 2a) undo velocity change:
              this.s2[j + PART_XVEL] *= this.drag;			        // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE! 
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision. 
              if(this.s2[j + PART_XVEL] > 0.0) 
                  this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_XVEL] =  this.resti * this.s2[j + PART_XVEL];	// sign changed-- don't need another.
            }
            //--------  floor (-Y) wall  --------------------------------------------  		
            if( this.s2[j + PART_YPOS] < -0.9) { // && this.s2[j + PART_YVEL] < 0.0) {		
            // collision! floor...  
              this.s2[j + PART_YPOS] = this.s1[j + PART_YPOS];// 1) resolve contact: put particle at wall.
              this.s2[j + PART_YVEL] = this.s1[j + PART_YVEL];	// 2a) undo velocity change:
              this.s2[j + PART_YVEL] *= this.drag;		          // 2b) apply drag:	
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE!
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision.
              if(this.s2[j + PART_YVEL] < 0.0) 
                  this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_YVEL] =  this.resti * this.s2[j + PART_YVEL];	// sign changed-- don't need another.
            }
            //--------  ceiling (+Y) wall  ------------------------------------------
            else if( this.s2[j + PART_YPOS] > 0.9) { // && this.s2[j + PART_YVEL] > 0.0) {
                // collision! ceiling...
              this.s2[j + PART_YPOS] = this.s1[j + PART_YPOS];// 1) resolve contact: put particle at wall.
              this.s2[j + PART_YVEL] = this.s1[j + PART_YVEL];	// 2a) undo velocity change:
              this.s2[j + PART_YVEL] *= this.drag;			        // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE!
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision.
              if(this.s2[j + PART_YVEL] > 0.0) 
                  this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_YVEL] =  this.resti * this.s2[j + PART_YVEL];	// sign changed-- don't need another.
            }
            //--------  near (-Z) wall  --------------------------------------------- 
            if( this.s2[j + PART_ZPOS] < -0.9) { // && this.s2[j + PART_ZVEL] < 0.0 ) {
            // collision! 
              this.s2[j + PART_ZPOS] = this.s1[j + PART_ZPOS];// 1) resolve contact: put particle at wall.
              this.s2[j + PART_ZVEL] = this.s1[j + PART_ZVEL];  // 2a) undo velocity change:
              this.s2[j + PART_ZVEL] *= this.drag;			        // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE! ------------------------------
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision. 
              if( this.s2[j + PART_ZVEL] < 0.0) 
                  this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_ZVEL] =  this.resti * this.s2[j + PART_ZVEL];	// sign changed-- don't need another.
            }
            //--------  far (+Z) wall  ---------------------------------------------- 
            else if( this.s2[j + PART_ZPOS] >  0.9) { // && this.s2[j + PART_ZVEL] > 0.0) {	
            // collision! 
              this.s2[j + PART_ZPOS] = this.s1[j + PART_ZPOS]; // 1) resolve contact: put particle at wall.
              this.s2[j + PART_ZVEL] = this.s1[j + PART_ZVEL];  // 2a) undo velocity change:
              this.s2[j + PART_ZVEL] *= this.drag;			        // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE! ------------------------------
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision.   			
              if(this.s2[j + PART_ZVEL] > 0.0) 
                  this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_ZVEL] =  this.resti * this.s2[j + PART_ZVEL];	// sign changed-- don't need another.
            } // end of (+Z) wall constraint
          } // end of for-loop for all particles
        } // end of bounceType==1 
        else {
          console.log('?!?! unknown constraint: PartSysVBO.bounceType==' + this.bounceType);
          return;
        }
        

      //-----------------------------add 'age' constraint:
        // if(this.isFountain == 1)    // When particle age falls to zero, re-initialize
                                    // to re-launch from a randomized location with
                                    // a randomized velocity and randomized age.
                                    
        var j = 0;  // i==particle number; j==array index for i-th particle
        for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
          // if (this.s2[j + PART_AGE] < 1000000){
          //   console.log("made it to dec");
          // } 

          if (this.isFountain == 1){
          this.s2[j + PART_AGE] -= 1;     // decrement lifetime.
          }

          // this.s2[j + PART_AGE] -= 1;     // decrement lifetime.
          
          if(this.s2[j + PART_AGE] <= 0) { // End of life: RESET this particle!
            if(this.isFire){
              { // End of life: RESET this particle!
                this.roundRand();       // set this.randX,randY,randZ to random location in 
                                        // a 3D unit sphere centered at the origin.
                //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
                // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8)
                this.s2[j + PART_XPOS] = -0.0 + 0.2*this.randX; 
                this.s2[j + PART_YPOS] = -0.0 + 0.2*this.randY;  
                this.s2[j + PART_ZPOS] = -0.7 + 0.2*this.randZ;
                this.s2[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
                this.roundRand(); // Now choose random initial velocities too:
                // this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + 0.2*this.randX);
                // this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.5 + 0.2*this.randY);
                this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randX);
                this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randY);
                this.s2[j + PART_ZVEL] =  this.INIT_VEL*(0.5 + this.randomScalar*this.randZ);
                this.s2[j + PART_MASS] =  1.0;      // mass, in kg.
                this.s2[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
                this.s2[j + PART_RENDMODE] = 0.0;
                this.s2[j + PART_AGE] = 15 + 10*Math.random();
                }
            } else if (!this.isFire){
              { // End of life: RESET this particle!
                this.roundRand();       // set this.randX,randY,randZ to random location in 
                                        // a 3D unit sphere centered at the origin.
                //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
                // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8)
                this.s2[j + PART_XPOS] = 0.8*this.randX; 
                this.s2[j + PART_YPOS] = 0.8*this.randY;  
                this.s2[j + PART_ZPOS] = 0.7 + 0.2*this.randZ;
                this.s2[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
                this.roundRand(); // Now choose random initial velocities too:
                // this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + 0.2*this.randX);
                // this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.5 + 0.2*this.randY);
                this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randX);
                this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randY);
                this.s2[j + PART_ZVEL] =  this.INIT_VEL*(0.5 + this.randomScalar*this.randZ);
                this.s2[j + PART_MASS] =  1.0;      // mass, in kg.
                this.s2[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
                this.s2[j + PART_RENDMODE] = 0.0;
                this.s2[j + PART_AGE] = 150 + 100*Math.random();
                }
            }
            // this.roundRand();       // set this.randX,randY,randZ to random location in 
            //                         // a 3D unit sphere centered at the origin.
            // //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
            // // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8)
            // this.s2[j + PART_XPOS] = -0.0 + 0.2*this.randX; 
            // this.s2[j + PART_YPOS] = -0.0 + 0.2*this.randY;  
            // this.s2[j + PART_ZPOS] = -0.7 + 0.2*this.randZ;
            // this.s2[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
            // this.roundRand(); // Now choose random initial velocities too:
            // // this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + 0.2*this.randX);
            // // this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.5 + 0.2*this.randY);
            // this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randX);
            // this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randY);
            // this.s2[j + PART_ZVEL] =  this.INIT_VEL*(0.5 + this.randomScalar*this.randZ);
            // this.s2[j + PART_MASS] =  1.0;      // mass, in kg.
            // this.s2[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
            // this.s2[j + PART_RENDMODE] = 0.0;
            // this.s2[j + PART_AGE] = 15 + 10*Math.random();
          } // if age <=0
        } // for loop thru all particles   

        break;

      case LIM_OLD_BOID:
        // console.log(this.bounceType);
        if(this.bounceType==0) { //------------------------------------------------
          var j = 0;  // i==particle number; j==array index for i-th particle
          for(var i = m; i < mmax; i += 1, j+= PART_MAXVAR) {
            // simple velocity-reversal: 
            if(      this.s2[j + PART_XPOS] < -0.9 && this.s2[j + PART_XVEL] < 0.0) { 
              // bounce on left (-X) wall
              this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; 
            }
            else if( this.s2[j + PART_XPOS] >  0.9 && this.s2[j + PART_XVEL] > 0.0) {		
              // bounce on right (+X) wall
              this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL];
            } //---------------------------
            if(      this.s2[j + PART_YPOS] < -0.9 && this.s2[j + PART_YVEL] < 0.0) {
              // bounce on floor (-Y)
              this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL];
            }
            else if( this.s2[j + PART_YPOS] >  0.9 && this.s2[j + PART_YVEL] > 0.0) {		
              // bounce on ceiling (+Y)
              this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL];
            } //---------------------------
            if(      this.s2[j + PART_ZPOS] < -0.9 && this.s2[j + PART_ZVEL] < 0.0) {
              // bounce on near wall (-Z)
              this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL];
            }
            else if( this.s2[j + PART_ZPOS] >  0.9 && this.s2[j + PART_ZVEL] > 0.0) {		
              // bounce on far wall (+Z)
              this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL];
              }	

            if(      this.s2[j + PART_YPOS] < -0.9) this.s2[j + PART_YPOS] = -0.9;
            else if( this.s2[j + PART_YPOS] >  0.9) this.s2[j + PART_YPOS] =  0.9; // ceiling
            if(      this.s2[j + PART_XPOS] < -0.9) this.s2[j + PART_XPOS] = -0.9; // left wall
            else if( this.s2[j + PART_XPOS] >  0.9) this.s2[j + PART_XPOS] =  0.9; // right wall
            if(      this.s2[j + PART_ZPOS] < -0.9) this.s2[j + PART_ZPOS] = -0.9; // near wall
            else if( this.s2[j + PART_ZPOS] >  0.9) this.s2[j + PART_ZPOS] =  0.9; // far wall

          // constraints for ALL the walls:
          } // end of for-loop thru all particles
        } // end of 'if' for bounceType==0
        else if (this.bounceType==1) { 
        //-----------------------------------------------------------------
          var j = 0;  // i==particle number; j==array index for i-th particle
          for(var i = m; i < mmax; i += 1, j+= PART_MAXVAR) {
            //--------  left (-X) wall  ----------
            if( this.s2[j + PART_XPOS] < -0.9) {// && this.s2[j + PART_XVEL] < 0.0 ) {
            // collision!
              this.s2[j + PART_XPOS] = this.s1[j + PART_XPOS];// 1) resolve contact: put particle at wall.
              this.s2[j + PART_XVEL] = this.s1[j + PART_XVEL];  // 2a) undo velocity change:
              this.s2[j + PART_XVEL] *= this.drag;	            // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE!
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision. 
              if( this.s2[j + PART_XVEL] < 0.0) 
                  this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_XVEL] =  this.resti * this.s2[j + PART_XVEL]; // sign changed-- don't need another.
            }
            //--------  right (+X) wall  --------------------------------------------
            else if( this.s2[j + PART_XPOS] >  0.9) { // && this.s2[j + PART_XVEL] > 0.0) {	
            // collision!
              this.s2[j + PART_XPOS] = this.s1[j + PART_XPOS]; // 1) resolve contact: put particle at wall.
              this.s2[j + PART_XVEL] = this.s1[j + PART_XVEL];	// 2a) undo velocity change:
              this.s2[j + PART_XVEL] *= this.drag;			        // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE! 
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision. 
              if(this.s2[j + PART_XVEL] > 0.0) 
                  this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_XVEL] =  this.resti * this.s2[j + PART_XVEL];	// sign changed-- don't need another.
            }
            //--------  floor (-Y) wall  --------------------------------------------  		
            if( this.s2[j + PART_YPOS] < -0.9) { // && this.s2[j + PART_YVEL] < 0.0) {		
            // collision! floor...  
              this.s2[j + PART_YPOS] = this.s1[j + PART_YPOS];// 1) resolve contact: put particle at wall.
              this.s2[j + PART_YVEL] = this.s1[j + PART_YVEL];	// 2a) undo velocity change:
              this.s2[j + PART_YVEL] *= this.drag;		          // 2b) apply drag:	
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE!
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision.
              if(this.s2[j + PART_YVEL] < 0.0) 
                  this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_YVEL] =  this.resti * this.s2[j + PART_YVEL];	// sign changed-- don't need another.
            }
            //--------  ceiling (+Y) wall  ------------------------------------------
            else if( this.s2[j + PART_YPOS] > 0.9) { // && this.s2[j + PART_YVEL] > 0.0) {
                // collision! ceiling...
              this.s2[j + PART_YPOS] = this.s1[j + PART_YPOS];// 1) resolve contact: put particle at wall.
              this.s2[j + PART_YVEL] = this.s1[j + PART_YVEL];	// 2a) undo velocity change:
              this.s2[j + PART_YVEL] *= this.drag;			        // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE!
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision.
              if(this.s2[j + PART_YVEL] > 0.0) 
                  this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_YVEL] =  this.resti * this.s2[j + PART_YVEL];	// sign changed-- don't need another.
            }
            //--------  near (-Z) wall  --------------------------------------------- 
            if( this.s2[j + PART_ZPOS] < -0.9) { // && this.s2[j + PART_ZVEL] < 0.0 ) {
            // collision! 
              this.s2[j + PART_ZPOS] = this.s1[j + PART_ZPOS];// 1) resolve contact: put particle at wall.
              this.s2[j + PART_ZVEL] = this.s1[j + PART_ZVEL];  // 2a) undo velocity change:
              this.s2[j + PART_ZVEL] *= this.drag;			        // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE! ------------------------------
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision. 
              if( this.s2[j + PART_ZVEL] < 0.0) 
                  this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_ZVEL] =  this.resti * this.s2[j + PART_ZVEL];	// sign changed-- don't need another.
            }
            //--------  far (+Z) wall  ---------------------------------------------- 
            else if( this.s2[j + PART_ZPOS] >  0.9) { // && this.s2[j + PART_ZVEL] > 0.0) {	
            // collision! 
              this.s2[j + PART_ZPOS] = this.s1[j + PART_ZPOS]; // 1) resolve contact: put particle at wall.
              this.s2[j + PART_ZVEL] = this.s1[j + PART_ZVEL];  // 2a) undo velocity change:
              this.s2[j + PART_ZVEL] *= this.drag;			        // 2b) apply drag:
              // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
              // ATTENTION! VERY SUBTLE PROBLEM HERE! ------------------------------
              // need a velocity-sign test here that ensures the 'bounce' step will 
              // always send the ball outwards, away from its wall or floor collision.   			
              if(this.s2[j + PART_ZVEL] > 0.0) 
                  this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL]; // need sign change--bounce!
              else 
                  this.s2[j + PART_ZVEL] =  this.resti * this.s2[j + PART_ZVEL];	// sign changed-- don't need another.
            } // end of (+Z) wall constraint
          } // end of for-loop for all particles
        } // end of bounceType==1 
        else if(this.bounceType==2) { //------------------------------------------------
          var j = 0;  // i==particle number; j==array index for i-th particle
          for(var i = m; i < mmax; i += 1, j+= PART_MAXVAR) {
            // simple teleport: 
            if(      this.s2[j + PART_XPOS] < -0.9 && this.s2[j + PART_XVEL] < 0.0) { 
              // bounce on left (-X) wall
              this.s2[j + PART_XPOS] = -this.s2[j + PART_XPOS]; 
            }
            else if( this.s2[j + PART_XPOS] >  0.9 && this.s2[j + PART_XVEL] > 0.0) {		
              // bounce on right (+X) wall
              this.s2[j + PART_XPOS] = -this.s2[j + PART_XPOS]; 
            } //---------------------------
            if(      this.s2[j + PART_YPOS] < -0.9 && this.s2[j + PART_YVEL] < 0.0) {
              // bounce on floor (-Y)
              this.s2[j + PART_YPOS] = -this.s2[j + PART_YPOS]; 
            }
            else if( this.s2[j + PART_YPOS] >  0.9 && this.s2[j + PART_YVEL] > 0.0) {		
              // bounce on ceiling (+Y)
              this.s2[j + PART_YPOS] = -this.s2[j + PART_YPOS]; 
            } //---------------------------
            if(      this.s2[j + PART_ZPOS] < -0.9 && this.s2[j + PART_ZVEL] < 0.0) {
              // bounce on near wall (-Z)
              this.s2[j + PART_ZPOS] = -this.s2[j + PART_ZPOS]; 
            }
            else if( this.s2[j + PART_ZPOS] >  0.9 && this.s2[j + PART_ZVEL] > 0.0) {		
              // bounce on far wall (+Z)
              this.s2[j + PART_ZPOS] = -this.s2[j + PART_ZPOS]; 
              }	

            // if(this.s2[j + PART_YPOS] < -0.9){
            //   this.s2[j + PART_YPOS] = -0.9;
            // }
            // else if( this.s2[j + PART_YPOS] >  0.9){
            //   this.s2[j + PART_YPOS] =  0.9; // ceiling
            // }
            // if(      this.s2[j + PART_XPOS] < -0.9){
            //   this.s2[j + PART_XPOS] = -0.9; // left wall
            // }
            // else if( this.s2[j + PART_XPOS] >  0.9){
            //   this.s2[j + PART_XPOS] =  0.9; // right wall
            // }
            // if(      this.s2[j + PART_ZPOS] < -0.9){
            //   this.s2[j + PART_ZPOS] = -0.9; // near wall
            // }
            // else if( this.s2[j + PART_ZPOS] >  0.9){
            //    this.s2[j + PART_ZPOS] =  0.9; // far wall
            // }

          // constraints for ALL the walls:
          } // end of for-loop thru all particles
        } // end of 'if' for bounceType==0
        else {
          console.log('?!?! unknown constraint: PartSysVBO.bounceType==' + this.bounceType);
          return;
        }
        

      //-----------------------------add 'age' constraint:
        // if(this.isFountain == 1)    // When particle age falls to zero, re-initialize
                                    // to re-launch from a randomized location with
                                    // a randomized velocity and randomized age.
                                    
        var j = 0;  // i==particle number; j==array index for i-th particle
        for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
          // if (this.s2[j + PART_AGE] < 1000000){
          //   console.log("made it to dec");
          // } 

          if (this.isFountain == 1){
          this.s2[j + PART_AGE] -= 1;     // decrement lifetime.
          }

          // this.s2[j + PART_AGE] -= 1;     // decrement lifetime.
          
          if(this.s2[j + PART_AGE] <= 0) { // End of life: RESET this particle!
            this.roundRand();       // set this.randX,randY,randZ to random location in 
                                    // a 3D unit sphere centered at the origin.
            //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
            // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8)
            this.s2[j + PART_XPOS] = -0.0 + 0.2*this.randX; 
            this.s2[j + PART_YPOS] = -0.0 + 0.2*this.randY;  
            this.s2[j + PART_ZPOS] = -0.7 + 0.2*this.randZ;
            this.s2[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
            this.roundRand(); // Now choose random initial velocities too:
            // this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + 0.2*this.randX);
            // this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.5 + 0.2*this.randY);
            this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randX);
            this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.0 + this.randomScalar*this.randY);
            this.s2[j + PART_ZVEL] =  this.INIT_VEL*(0.5 + this.randomScalar*this.randZ);
            this.s2[j + PART_MASS] =  1.0;      // mass, in kg.
            this.s2[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
            this.s2[j + PART_RENDMODE] = 0.0;
            this.s2[j + PART_AGE] = 15 + 10*Math.random();
            } // if age <=0
        } // for loop thru all particles   

        break;
      default:
        console.log("!!!doConstraints() cList[",k,"] invalid limitType:", cList[k].limitType);
        break;
    } // switch(cList[k].limitType)
  } // for(k=0...)

  //Old brute force constrain
  /*

	if(this.bounceType==0) { //------------------------------------------------
    var j = 0;  // i==particle number; j==array index for i-th particle
    for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
  		// simple velocity-reversal: 
  		if(      this.s2[j + PART_XPOS] < -0.9 && this.s2[j + PART_XVEL] < 0.0) { 
  		  // bounce on left (-X) wall
  		   this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; 
  		}
  		else if( this.s2[j + PART_XPOS] >  0.9 && this.s2[j + PART_XVEL] > 0.0) {		
  		  // bounce on right (+X) wall
  			 this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL];
  		} //---------------------------
  		if(      this.s2[j + PART_YPOS] < -0.9 && this.s2[j + PART_YVEL] < 0.0) {
  			// bounce on floor (-Y)
  			 this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL];
  		}
  		else if( this.s2[j + PART_YPOS] >  0.9 && this.s2[j + PART_YVEL] > 0.0) {		
  		  // bounce on ceiling (+Y)
  			 this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL];
  		} //---------------------------
  		if(      this.s2[j + PART_ZPOS] < -0.9 && this.s2[j + PART_ZVEL] < 0.0) {
  			// bounce on near wall (-Z)
  			 this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL];
  		}
  		else if( this.s2[j + PART_ZPOS] >  0.9 && this.s2[j + PART_ZVEL] > 0.0) {		
  		  // bounce on far wall (+Z)
  			 this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL];
  			}	
  	//--------------------------
    // The above constraints change ONLY the velocity; nothing explicitly
    // forces the bouncy-ball to stay within the walls. If we begin with a
    // bouncy-ball on floor with zero velocity, gravity will cause it to 'fall' 
    // through the floor during the next timestep.  At the end of that timestep
    // our velocity-only constraint will scale velocity by -this.resti, but its
    // position is still below the floor!  Worse, the resti-weakened upward 
    // velocity will get cancelled by the new downward velocity added by gravity 
    // during the NEXT time-step. This gives the ball a net downwards velocity 
    // again, which again gets multiplied by -this.resti to make a slight upwards
    // velocity, but with the ball even further below the floor. As this cycle
    // repeats, the ball slowly sinks further and further downwards.
    // THUS the floor needs this position-enforcing constraint as well:
  		if(      this.s2[j + PART_YPOS] < -0.9) this.s2[j + PART_YPOS] = -0.9;
      else if( this.s2[j + PART_YPOS] >  0.9) this.s2[j + PART_YPOS] =  0.9; // ceiling
      if(      this.s2[j + PART_XPOS] < -0.9) this.s2[j + PART_XPOS] = -0.9; // left wall
      else if( this.s2[j + PART_XPOS] >  0.9) this.s2[j + PART_XPOS] =  0.9; // right wall
      if(      this.s2[j + PART_ZPOS] < -0.9) this.s2[j + PART_ZPOS] = -0.9; // near wall
      else if( this.s2[j + PART_ZPOS] >  0.9) this.s2[j + PART_ZPOS] =  0.9; // far wall
		// Our simple 'bouncy-ball' particle system needs this position-limiting
		// constraint ONLY for the floor and not the walls, as no forces exist that
		// could 'push' a zero-velocity particle against the wall. But suppose we
		// have a 'blowing wind' force that pushes particles left or right? Any
		// particle that comes to rest against our left or right wall could be
		// slowly 'pushed' through that wall as well -- THUS we need position-limiting
		// constraints for ALL the walls:
    } // end of for-loop thru all particles
	} // end of 'if' for bounceType==0
	else if (this.bounceType==1) { 
	//-----------------------------------------------------------------
	  var j = 0;  // i==particle number; j==array index for i-th particle
    for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
      //--------  left (-X) wall  ----------
  		if( this.s2[j + PART_XPOS] < -0.9) {// && this.s2[j + PART_XVEL] < 0.0 ) {
  		// collision!
  			this.s2[j + PART_XPOS] = -0.9;// 1) resolve contact: put particle at wall.
			  this.s2[j + PART_XVEL] = this.s1[j + PART_XVEL];  // 2a) undo velocity change:
  			this.s2[j + PART_XVEL] *= this.drag;	            // 2b) apply drag:
  		  // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
  			// ATTENTION! VERY SUBTLE PROBLEM HERE!
  			// need a velocity-sign test here that ensures the 'bounce' step will 
  			// always send the ball outwards, away from its wall or floor collision. 
  			if( this.s2[j + PART_XVEL] < 0.0) 
  			    this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; // need sign change--bounce!
  			else 
  			    this.s2[j + PART_XVEL] =  this.resti * this.s2[j + PART_XVEL]; // sign changed-- don't need another.
  		}
  		//--------  right (+X) wall  --------------------------------------------
  		else if( this.s2[j + PART_XPOS] >  0.9) { // && this.s2[j + PART_XVEL] > 0.0) {	
  		// collision!
  			this.s2[j + PART_XPOS] = 0.9; // 1) resolve contact: put particle at wall.
  			this.s2[j + PART_XVEL] = this.s1[j + PART_XVEL];	// 2a) undo velocity change:
  			this.s2[j + PART_XVEL] *= this.drag;			        // 2b) apply drag:
  		  // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
  			// ATTENTION! VERY SUBTLE PROBLEM HERE! 
  			// need a velocity-sign test here that ensures the 'bounce' step will 
  			// always send the ball outwards, away from its wall or floor collision. 
  			if(this.s2[j + PART_XVEL] > 0.0) 
  			    this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; // need sign change--bounce!
  			else 
  			    this.s2[j + PART_XVEL] =  this.resti * this.s2[j + PART_XVEL];	// sign changed-- don't need another.
  		}
      //--------  floor (-Y) wall  --------------------------------------------  		
  		if( this.s2[j + PART_YPOS] < -0.9) { // && this.s2[j + PART_YVEL] < 0.0) {		
  		// collision! floor...  
  			this.s2[j + PART_YPOS] = -0.9;// 1) resolve contact: put particle at wall.
  			this.s2[j + PART_YVEL] = this.s1[j + PART_YVEL];	// 2a) undo velocity change:
  			this.s2[j + PART_YVEL] *= this.drag;		          // 2b) apply drag:	
  		  // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
  			// ATTENTION! VERY SUBTLE PROBLEM HERE!
  			// need a velocity-sign test here that ensures the 'bounce' step will 
  			// always send the ball outwards, away from its wall or floor collision.
  			if(this.s2[j + PART_YVEL] < 0.0) 
  			    this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL]; // need sign change--bounce!
  			else 
  			    this.s2[j + PART_YVEL] =  this.resti * this.s2[j + PART_YVEL];	// sign changed-- don't need another.
  		}
  		//--------  ceiling (+Y) wall  ------------------------------------------
  		else if( this.s2[j + PART_YPOS] > 0.9) { // && this.s2[j + PART_YVEL] > 0.0) {
  		 		// collision! ceiling...
  			this.s2[j + PART_YPOS] = 0.9;// 1) resolve contact: put particle at wall.
  			this.s2[j + PART_YVEL] = this.s1[j + PART_YVEL];	// 2a) undo velocity change:
  			this.s2[j + PART_YVEL] *= this.drag;			        // 2b) apply drag:
  		  // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
  			// ATTENTION! VERY SUBTLE PROBLEM HERE!
  			// need a velocity-sign test here that ensures the 'bounce' step will 
  			// always send the ball outwards, away from its wall or floor collision.
  			if(this.s2[j + PART_YVEL] > 0.0) 
  			    this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL]; // need sign change--bounce!
  			else 
  			    this.s2[j + PART_YVEL] =  this.resti * this.s2[j + PART_YVEL];	// sign changed-- don't need another.
  		}
  		//--------  near (-Z) wall  --------------------------------------------- 
  		if( this.s2[j + PART_ZPOS] < -0.9) { // && this.s2[j + PART_ZVEL] < 0.0 ) {
  		// collision! 
  			this.s2[j + PART_ZPOS] = -0.9;// 1) resolve contact: put particle at wall.
  			this.s2[j + PART_ZVEL] = this.s1[j + PART_ZVEL];  // 2a) undo velocity change:
  			this.s2[j + PART_ZVEL] *= this.drag;			        // 2b) apply drag:
  		  // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
  			// ATTENTION! VERY SUBTLE PROBLEM HERE! ------------------------------
  			// need a velocity-sign test here that ensures the 'bounce' step will 
  			// always send the ball outwards, away from its wall or floor collision. 
  			if( this.s2[j + PART_ZVEL] < 0.0) 
  			    this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL]; // need sign change--bounce!
  			else 
  			    this.s2[j + PART_ZVEL] =  this.resti * this.s2[j + PART_ZVEL];	// sign changed-- don't need another.
  		}
  		//--------  far (+Z) wall  ---------------------------------------------- 
  		else if( this.s2[j + PART_ZPOS] >  0.9) { // && this.s2[j + PART_ZVEL] > 0.0) {	
  		// collision! 
  			this.s2[j + PART_ZPOS] = 0.9; // 1) resolve contact: put particle at wall.
  			this.s2[j + PART_ZVEL] = this.s1[j + PART_ZVEL];  // 2a) undo velocity change:
  			this.s2[j + PART_ZVEL] *= this.drag;			        // 2b) apply drag:
  		  // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
  			// ATTENTION! VERY SUBTLE PROBLEM HERE! ------------------------------
  			// need a velocity-sign test here that ensures the 'bounce' step will 
  			// always send the ball outwards, away from its wall or floor collision.   			
  			if(this.s2[j + PART_ZVEL] > 0.0) 
  			    this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL]; // need sign change--bounce!
  			else 
  			    this.s2[j + PART_ZVEL] =  this.resti * this.s2[j + PART_ZVEL];	// sign changed-- don't need another.
  		} // end of (+Z) wall constraint
  	} // end of for-loop for all particles
	} // end of bounceType==1 
	else {
		console.log('?!?! unknown constraint: PartSysVBO.bounceType==' + this.bounceType);
		return;
	}
  

//-----------------------------add 'age' constraint:
  if(this.isFountain == 1)    // When particle age falls to zero, re-initialize
                              // to re-launch from a randomized location with
                              // a randomized velocity and randomized age.
                              
  var j = 0;  // i==particle number; j==array index for i-th particle
  for(var i = 0; i < this.partCount; i += 1, j+= PART_MAXVAR) {
    this.s2[j + PART_AGE] -= 1;     // decrement lifetime.
    if(this.s2[j + PART_AGE] <= 0) { // End of life: RESET this particle!
      this.roundRand();       // set this.randX,randY,randZ to random location in 
                              // a 3D unit sphere centered at the origin.
      //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
      // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8)
      this.s2[j + PART_XPOS] = -0.0 + 0.2*this.randX; 
      this.s2[j + PART_YPOS] = -0.4 + 0.2*this.randY;  
      this.s2[j + PART_ZPOS] = -0.0 + 0.2*this.randZ;
      this.s2[j + PART_WPOS] =  1.0;      // position 'w' coordinate;
      this.roundRand(); // Now choose random initial velocities too:
      this.s2[j + PART_XVEL] =  this.INIT_VEL*(0.0 + 0.2*this.randX);
      this.s2[j + PART_YVEL] =  this.INIT_VEL*(0.5 + 0.2*this.randY);
      this.s2[j + PART_ZVEL] =  this.INIT_VEL*(0.0 + 0.2*this.randZ);
      this.s2[j + PART_MASS] =  1.0;      // mass, in kg.
      this.s2[j + PART_DIAM] =  2.0 + 10*Math.random(); // on-screen diameter, in pixels
      this.s2[j + PART_RENDMODE] = 0.0;
      this.s2[j + PART_AGE] = 30 + 100*Math.random();
      } // if age <=0
  }

*/

}

PartSysVBO.prototype.swap = function() {
//==============================================================================
// Choose the method you want:

// We can EXCHANGE, actually SWAP the contents of s1 and s2, like this:  
// but !! YOU PROBABLY DON'T WANT TO DO THIS !!
/*
  var tmp = this.s1;
  this.s1 = this.s2;
  this.s2 = tmp;
*/

// Or we can REPLACE s1 contents with s2 contents, like this:
// NOTE: if we try:  this.s1 = this.s2; we DISCARD s1's memory!!

  this.s1.set(this.s2);     // set values of s1 array to match s2 array.
// (WHY? so that your solver can make intermittent changes to particle
// values without any unwanted 'old' values re-appearing. For example,
// At timestep 36, particle 11 had 'red' color in s1, and your solver changes
// its color to blue in s2, but makes no further changes.  If swap() EXCHANGES 
// s1 and s2 contents, on timestep 37 the particle is blue, but on timestep 38
// the particle is red again!  If we REPLACE s1 contents with s2 contents, the
// particle is red at time step 36, but blue for 37, 38, 39 and all further
// timesteps until we change it again.
// REPLACE s1 contents with s2 contents:
}

// VBO specific functions

PartSysVBO.prototype.initVBO = function() {
  //==============================================================================
  
  // a) Compile,link,upload shaders-----------------------------------------------
    this.shaderLoc = createProgram(gl, this.VERT_SRC, this.FRAG_SRC);
    if (!this.shaderLoc) {
      console.log(this.constructor.name + 
                  '.init() failed to create executable Shaders on the GPU. Bye!');
      return;
    }
  // CUTE TRICK: let's print the NAME of this VBObox object: tells us which one!
  //  else{console.log('You called: '+ this.constructor.name + '.init() fcn!');}
  
    gl.program = this.shaderLoc;		// (to match cuon-utils.js -- initShaders())
  // Thank you Jipeng

  gl.useProgram(this.shaderLoc);

// b) Create VBO on GPU, fill it------------------------------------------------
  // c2) Find All Uniforms:-----------------------------------------------------
//   //Get GPU storage location for each uniform var used in our shader programs: 
//  this.u_ModelMatLoc = gl.getUniformLocation(this.shaderLoc, 'u_ModelMatrix');
//   if (!this.u_ModelMatLoc) { 
//     console.log(this.constructor.name + 
//                 '.init() failed to get GPU location for u_ModelMatrix uniform');
//     return;
//   }

  // Create a vertex buffer object (VBO) in the graphics hardware: get its ID# 
  this.vboID = gl.createBuffer();
  if (!this.vboID) {
    console.log('PartSysVBO.init() Failed to create the VBO object in the GPU');
    return -1;
  }
  // "Bind the new buffer object (memory in the graphics system) to target"
  // In other words, specify the usage of one selected buffer object.
  // What's a "Target"? it's the poorly-chosen OpenGL/WebGL name for the 
  // intended use of this buffer's memory; so far, we have just two choices:
  //	== "gl.ARRAY_BUFFER" meaning the buffer object holds actual values we 
  //      need for rendering (positions, colors, normals, etc), or 
  //	== "gl.ELEMENT_ARRAY_BUFFER" meaning the buffer object holds indices 
  // 			into a list of values we need; indices such as object #s, face #s, 
  //			edge vertex #s.
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vboID);

  // Write data from our JavaScript array to graphics systems' buffer object:
  gl.bufferData(gl.ARRAY_BUFFER, this.s1, gl.DYNAMIC_DRAW);
  // why 'DYNAMIC_DRAW'? Because we change VBO's content with bufferSubData() later

  // ---------Set up all attributes for VBO contents:
  //Get the ID# for the a_Position variable in the graphics hardware
  
 this.u_ModelMatLoc = gl.getUniformLocation(this.shaderLoc, 'u_ModelMatrix');
 if (!this.u_ModelMatLoc) { 
   console.log(this.constructor.name + 
               '.init() failed to get GPU location for u_ModelMatrix uniform');
   return;
 }

  this.a_PositionID = gl.getAttribLocation(gl.program, 'a_Position');
  if(this.a_PositionID < 0) {
    console.log('PartSysVBO.init() Failed to get the storage location of a_Position');
    return -1;
  }
  // Tell GLSL to fill the 'a_Position' attribute variable for each shader with
  // values from the buffer object chosen by 'gl.bindBuffer()' command.
  // websearch yields OpenGL version: 
  //		http://www.opengl.org/sdk/docs/man/xhtml/glVertexAttribPointer.xml
  gl.vertexAttribPointer(this.a_PositionID, 
          4,  // # of values in this attrib (1,2,3,4) 
          gl.FLOAT, // data type (usually gl.FLOAT)
          false,    // use integer normalizing? (usually false)
          PART_MAXVAR*this.FSIZE,  // Stride: #bytes from 1st stored value to next one
          PART_XPOS * this.FSIZE); // Offset; #bytes from start of buffer to 
                    // 1st stored attrib value we will actually use.
  // Enable this assignment of the bound buffer to the a_Position variable:
  gl.enableVertexAttribArray(this.a_PositionID);
  

  this.a_LifeLeftID = gl.getAttribLocation(gl.program, 'a_LifeLeft');
  if(this.a_LifeLeftID < 0) {
    console.log('PartSys.init() Failed to get the storage location of a_LifeLeft');
    return -1;
  }

gl.vertexAttribPointer(this.a_LifeLeftID, 
          1,  // # of values in this attrib (1,2,3,4) 
          gl.FLOAT, // data type (usually gl.FLOAT)
          false,    // use integer normalizing? (usually false)
          PART_MAXVAR*this.FSIZE,  // Stride: #bytes from 1st stored value to next one
          PART_AGE * this.FSIZE); // Offset; #bytes from start of buffer to 
                    // 1st stored attrib value we will actually use.
  // Enable this assignment of the bound buffer to the a_Position variable:
  gl.enableVertexAttribArray(this.a_LifeLeftID);
  //------------------------------------------
  // ---------Set up all uniforms we send to the GPU:
  // Get graphics system storage location of each uniform our shaders use:
  // (why? see  http://www.opengl.org/wiki/Uniform_(GLSL) )
  this.u_runModeID = gl.getUniformLocation(gl.program, 'u_runMode');
  if(!this.u_runModeID) {
  	console.log('PartSysVBO.init() Failed to get u_runMode variable location');
  	return;
  }  

  // b) Create VBO on GPU, fill it------------------------------------------------
    // c2) Find All Uniforms:-----------------------------------------------------
    //Get GPU storage location for each uniform var used in our shader programs: 
   this.u_ModelMatLoc = gl.getUniformLocation(this.shaderLoc, 'u_ModelMatrix');
    if (!this.u_ModelMatLoc) { 
      console.log(this.constructor.name + 
                  '.init() failed to get GPU location for u_ModelMatrix uniform');
      return;
    }
    // Thank you Jipeng
  }

PartSysVBO.prototype.switchToMe = function () {
  //==============================================================================
  // Set GPU to use this VBObox's contents (VBO, shader, attributes, uniforms...)
  
  // a) select our shader program:
    gl.useProgram(this.shaderLoc);	
  //		Each call to useProgram() selects a shader program from the GPU memory,

    gl.bindBuffer(gl.ARRAY_BUFFER,	    // GLenum 'target' for this GPU buffer 
                      this.vboID);			// the ID# the GPU uses for our VBO.
  
    gl.vertexAttribPointer(
      this.a_PositionID,//index == ID# for the attribute var in GLSL shader pgm;
      4, // this.vboFcount_a_Pos1, // # of floats used by this attribute: 1,2,3 or 4?
      gl.FLOAT,		  // type == what data type did we use for those numbers?
      false,				// isNormalized == are these fixed-point values that we need
                    //									normalize before use? true or false
      PART_MAXVAR*this.FSIZE,  // Stride: #bytes from 1st stored value to next one
      PART_XPOS * this.FSIZE);					
                    // Offset == how many bytes from START of buffer to the first
                    // value we will actually use?  (we start with position).
    gl.enableVertexAttribArray(this.a_PositionID);

    
    gl.vertexAttribPointer(this.a_LifeLeftID,//index == ID# for the attribute var in GLSL shader pgm;
                1, // this.vboFcount_a_Pos1, // # of floats used by this attribute: 1,2,3 or 4?
                gl.FLOAT,		  // type == what data type did we use for those numbers?
                false,				// isNormalized == are these fixed-point values that we need
                              //									normalize before use? true or false
                PART_MAXVAR*this.FSIZE,  // Stride: #bytes from 1st stored value to next one
                PART_AGE * this.FSIZE);					
                              // Offset == how many bytes from START of buffer to the first
                              // value we will actually use?  (we start with position).
    gl.enableVertexAttribArray(this.a_LifeLeftID);

    // gl.enableVertexAttribArray(this.a_Colr1Loc);
    gl.uniform1i(this.u_runModeID, this.runMode);

  }

PartSysVBO.prototype.adjust = function() {
  //==============================================================================
  // Update the GPU to newer, current values we now store for 'uniform' vars on 
  // the GPU; and (if needed) update each attribute's stride and offset in VBO.
  
  //   // check: was WebGL context set to use our VBO & shader program?
  //   if(this.isReady()==false) {
  //         console.log('ERROR! before' + this.constructor.name + 
  //   						'.adjust() call you needed to call this.switchToMe()!!');
  //   }
  // 	// Adjust values for our uniforms,
  // 	this.ModelMatrix.setIdentity();
  // Thank you Jipeng
     this.ModelMat.setIdentity();
     this.ModelMat.set(g_worldMat);
    //  this.ModelMat.rotate(90, 1, 0, 0)
     this.ModelMat.translate(this.loc[0], this.loc[1],this.loc[2]);						// then translate them.

    

     gl.uniformMatrix4fv(this.u_ModelMatLoc,	// GPU location of the uniform
      false, 				// use matrix transpose instead?
      this.ModelMat.elements);	// send data from Javascript.
  
  // //  this.ModelMatrix.rotate(g_angleNow1, 0, 0, 1);	// -spin drawing axes,
  //   //  Transfer new uniforms' values to the GPU:-------------
  //   // Send  new 'ModelMat' values to the GPU's 'u_ModelMat1' uniform: 
  //   gl.uniformMatrix4fv(this.u_ModelMatrixLoc,	// GPU location of the uniform
  //   										false, 										// use matrix transpose instead?
  //   										this.ModelMatrix.elements);	// send data from Javascript.
  
  //   //Step 1A: Adding calculation code
    
  //   // update particle system state? =====================
  //   if (this.g_partA.runMode > 1) {
  //     // 0=reset; 1= pause; 2=step; 3=run
  //     // YES! advance particle system(s) by 1 timestep.
  //     if (this.g_partA.runMode == 2) {
  //       // (if runMode==2, do just one step & pause)
  //      this.g_partA.runMode = 1;
  //     }
  //     //==========================================
  //     //===========================================
  //     //
  //     //  PARTICLE SIMULATION LOOP: (see Lecture Notes D)
  //     //
  //     //==========================================
  //     //==========================================
  //     // Make our 'bouncy-ball' move forward by one timestep, but now the 's' key
  //     // will select which kind of solver to use by changingthis.g_partA.solvType:
  //    this.g_partA.applyForces(this.g_partA.s1,this.g_partA.forceList); // find current net force on each particle
  //    this.g_partA.dotFinder(this.g_partA.s1dot,this.g_partA.s1); // find time-derivative s1dot from s1;
  //    this.g_partA.solver(); // find s2 from s1 & related states.
  //    this.g_partA.doConstraints(); // Apply all constraints.  s2 is ready!
  //    this.g_partA.render(); // transfer current state to VBO, set uniforms, draw it!
  //    this.g_partA.swap(); // Make s2 the new current state s1.s
  //     //===========================================
  //     //===========================================
  //   } else {
  //     // runMode==0 (reset) or ==1 (pause): re-draw existing particles.
  //    this.g_partA.render();
  //   }
  
  }

PartSysVBO.prototype.reload = function() {
  //=============================================================================
  // Over-write current values in the GPU for our already-created VBO: use 
  // gl.bufferSubData() call to re-transfer some or all of our Float32Array 
  // contents to our VBO without changing any GPU memory allocations.
  
    gl.bufferSubData(gl.ARRAY_BUFFER, 	// GLenum target(same as 'bindBuffer()')
                    0,                  // byte offset to where data replacement
                                        // begins in the VBO.
                      this.s1);   // the JS source-data array used to fill VBO
  }


PartSysVBO.prototype.isReady = function() {
  //==============================================================================
  // Returns 'true' if our WebGL rendering context ('gl') is ready to render using
  // this objects VBO and shader program; else return false.
  // see: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getParameter
  
  var isOK = true;
  
    if(gl.getParameter(gl.CURRENT_PROGRAM) != this.shaderLoc)  {
      console.log(this.constructor.name + 
                  '.isReady() false: shader program at this.shaderLoc not in use!');
      isOK = false;
    }
    if(gl.getParameter(gl.ARRAY_BUFFER_BINDING) != this.vboID) {
        console.log(this.constructor.name + 
                '.isReady() false: vbo at this.vboLoc not in use!');
      isOK = false;
    }
    return isOK;
  }

