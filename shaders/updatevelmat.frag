varying vec2 vUv;
uniform float clothWidth;
uniform sampler2D tVelocity;  
uniform sampler2D tPositions;
uniform float u_timestep;
uniform float u_mass;
uniform float u_windX;
uniform float u_windY;
uniform float u_windZ;
uniform float u_time;
uniform float u_damping;
uniform vec4 u_pins;
uniform vec2 Str;
uniform vec2 Shr;
uniform vec2 Bnd;

// returns the position of the given vertex along with its spring and damping constants
vec2 getNeighbor(int n, out float ks, out float kd) {

   // structural springs (adjacent neighbors)
   //
   //        o
   //        |
   //     o--m--o
   //        |
   //        o
   //

  if (n < 4){ ks = Str[0]; kd = Str[1]; } //ksStr, kdStr
  if (n == 0) return vec2(1.0, 0.0);
  if (n == 1) return vec2(0.0, -1.0);
  if (n == 2) return vec2(-1.0, 0.0);
  if (n == 3) return vec2(0.0, 1.0);

   // shear springs (diagonal neighbors)
   //
   //     o  o  o
   //      \   /
   //     o  m  o
   //      /   \
   //     o  o  o
   //

  if (n < 8) { ks = Shr[0]; kd = Shr[1]; } //ksShr,kdShr
  if (n == 4) return vec2(1.0, -1.0);
  if (n == 5) return vec2(-1.0, -1.0);
  if (n == 6) return vec2(-1.0, 1.0);
  if (n == 7) return vec2(1.0, 1.0);

   // bend spring (adjacent neighbors 1 node away)   
   //
   //     o   o   o   o   o
   //             | 
   //     o   o   |   o   o
   //             |   
   //     o-------m-------o
   //             |  
   //     o   o   |   o   o
   //             |
   //     o   o   o   o   o
   //

  if (n < 12) { ks = Bnd[0]; kd = Bnd[1]; } //ksBnd,kdBnd
  if (n == 8) return vec2(2.0, 0.0);
  if (n == 9) return vec2(0.0, -2.0);
  if (n == 10) return vec2(-2.0, 0.0);
  if (n == 11) return vec2(0.0, 2.0);
  return vec2(0.0,0.0);
}

void main() {
// Get the attributes of the current particle
  vec4 pos = texture2D(tPositions, vUv);
  vec4 vel =  texture2D(tVelocity, vUv);

// Set a constant gravitational force
  vec3 gravity = vec3(0.0, -9.8 * 0.1, 0.0);

// Set the gravity as a constant base force (simplified)
  vec3 force = gravity * u_mass;

// Add damping
  force += -u_damping * vel.xyz;

// Wind simulation (add 10 to not have the cloth be instantly blocked on initialization )
  force.x += u_windX * sin(u_time + 10.0);
  force.y += u_windY * cos(u_time + 10.0);
  force.z += u_windZ * sin(u_time + 10.0);

// Get neighbors
// Compute for all 12 neighbors of the current vertex (constructed by the springs above)
//
//             o        
//             | 
//         o---o---o    
//         | \ | / |
//     o---o---m---o---o
//         | / | \ |
//         o---o---o    
//             |
//             o        

// Satisfy the constraints
  for (int k = 0; k < 12; k++) {
    vec3 tempVel = vel.xyz;
    float ks, kd;

     // Get neighbor coordinates
    vec2 neighborCoord = getNeighbor(k, ks, kd);

     // Size of a single patch in world space
    float invClothSize = 1.0 / clothWidth;

     // Length of a single patch at rest
    float restLength = length(neighborCoord * invClothSize);

    neighborCoord = neighborCoord * (1.0 / clothWidth);
    vec2 newCoord = vUv + neighborCoord;

     // Check for out of bounds indices
    if(newCoord.x <= 0.0 || newCoord.x >= 1.0 || newCoord.y <= 0.0 || newCoord.y >= 1.0) continue;

     // Calculate the velocity and change in position and velocity
    vec3 posNeighborParticle = texture2D(tPositions, newCoord).xyz;
    vec3 velNeighborParticle = texture2D(tVelocity, newCoord).xyz;
    vec3 deltaPos = pos.xyz - posNeighborParticle;
    tempVel += deltaPos;
    vec3 deltaVel = tempVel - velNeighborParticle;
    float distance = length(deltaPos);

     // Calculate the spring force
    vec3 springForce = (-ks * (distance - restLength) + kd * (dot(deltaVel, deltaPos) / distance)) * normalize(deltaPos);
    force += springForce;
  };

   // Calculate the acceleration using Newtons second law of motion: a = F / m
  vec3 acc;
  if(u_mass == 0.0) acc = vec3(0.0); else acc = force / u_mass;

  bool pinBoolean = false;  
  if(!pinBoolean) pinBoolean = (vUv.y < 0.035 && vUv.x < 0.035 && u_pins.y > 0.0); //Pin 1, Top left
  if(!pinBoolean) pinBoolean = (vUv.y > 0.965 && vUv.x < 0.035 && u_pins.x > 0.0); // Pin 2, Top right

   // If the vertex is within the declared pin area make sure to fixate the position
  if(pinBoolean) {
    vel.xyz = vec3(0.0);
  } else {

     // Eulers semi-implicit method is broken up into two steps:
     // 1. VelocityNew = VelocityCurrent -> VelocityNew += Acceleration * Timestep
     // 2. PositionNew = PositionCurrent -> PositionNew += VelocityNew * Timestep 

     // First part of semi-implicit Eulers method
    vel.xyz += acc * u_timestep;
  }

   // Set the new velocity of the particle
  gl_FragColor = vec4(vel.xyz,1.0);
}