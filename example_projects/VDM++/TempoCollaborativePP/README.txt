Author: 


This is a brief description on how to run the TEMPO demonstrator, and how to configure it. This is without the graphical 
extensions made in the project for Overture: for the use of those we refer to the associated manuals. The below is still
relevant if you want to use the graphical extensions, though.

The demonstrator is executed by launching a run configuration. So in order to do that you have to make one. A typical example
has the following parameters:
- Launch mode: Entry point
- Class: World()
- Function/Operation: Run("RotterdamNetwork.csv", "TMSconfiguration.csv", 300)

The operation "Run" takes three parameters:
- A network configuration (in the example: "RotterdamNetwork.csv")
- The configuration of the TMS in the system (in the example: "TMSconfiguration.csv")
- The duration of the simulation in units of 10 seconds, which is the cycle time between the Java simulator and the VDM 
  model. In the example it is 300, that means 3000 seconds = 50 minutes. Since the simulator first takes 20 minutes 
  without interacting with the model this means that the total run time is 70 minutes in the example.
  
All configuration files are .csv, so basically comma seperated text files.

The following files are relevant:
- network description
- TMS configuration
- geographic description of the network
- description of the events taking place during the simulation.

*** Network desscription ***

This file contains the following information for every edge in the network:
- The identifier of the edge
- the starting node for the edge
- the end node for the edge
- the length of the edge
- the number of lanes that the edge has
- the maximum speed for the edge
- flow of cars into the edge

An example line in the file could be: "A201","A20S","A20A4",1,2,70,240

*** TMS description ***

This file contains the following information for every TMS in the network:
- the identification of the TMS
- an identification of the edge included
- a traffic control measure if available (alternatively nil is included)
- a priority if available (alternatively nil is included, lower numbers mean a higher priority)
- possible suggested routes to make diversions avoiding the edge (currently this value is always nil)

An example line in the file could be: "RWS","A152","HardShoulder",1,nil

*** Geographic description ***

This is only relevant for the Java simulator. The file should always have the name "GeoInfo.csv". It specifies
the geographic location in terms of GPS coordinates for each node in the network, so that the simulator knows
where to plot it on the map.

*** Events ***

Describes the events that take place during the simulation. Each line contains:

- Time in seconds after t=0 the event occurs (i.e. including the 20 minute initialisation time that the simulator takes to 
  fill the network
- The type of event. This can be one of the following:
  * SetInputStream -- sets the number of vehicles injected on a certain edge in terms of #vehicles/minute
  * BridgeOpen -- opens a bridge (should result in a diversion if possible)
  * BridgeClose --  closes a bridge (NB to work correctly a bridge should be closed explicitly at t=0)
  * Incident -- typcially an accident that blocks part of the road, thus limiting the capacity of an edge
  * IncidentEnds -- End the incident and increases capacity again
- the edge where the event occurs
- a numeric value relevant for the edge. In case of:
  * A SetInputStream event: #vehicles/minute injected in the edge
  * Bridge or Incident: the percentage related to the length of the edge at which the bridge or incident is located.
  
An example line in the file could be: 1220,"SetInputStream","A153",5

*** Use of Overture Graphics Support ***

As a part of the TEMPO project a new plug-in on top of the Overture tool called the "Overture Graphics 
Plugin Development". Thus, it is possible to update versions of Overture version 2.4.0 or higher under
"Help -> Install New Software" inside the Overture Eclipse tool. After having installed the plug-in it is
possible to add this feature for a specific project by selecting "Overture Graphics -> Add Overture 
Graphics Library" by right-clicking on a project. When this have been carried out debugging can be started
with a special "Vdm Graphics Application" and this will start up a seperate Electron application called the
"Overture Graphics Plugin". Here one need to choose the root class (in this case "World") and afterwards 
what top-level method to run (in this can one can either select "run" or "runwithoutcollab"). Afterwards, 
it is possible to define multiple plots which can be viewed while a VDM simulation is on-going (either in 
2D  or 3D). For this model it makes sense to monitor "tmsX.averagedensity" and "tmsX.averagevelocity" where
X is either 1 or 2. Finally, it is possible to select a plot and dooble click on it and then start the VDM
simulator with the selected operation. In this case a new GUI (programmed in Java) will come up and then 
from there the entire simulation can be started up.


Language Version: vdm10
Entry point     : new World().Run("RotterdamNetwork.csv", "TMSconfiguration.csv", 300)
Entry point     : new World().runwithoutcollab()