Author: Paul Chisholm


This is a model of an Air Traffic Flow Management (ATFM) departure Traffic Management Initiative
  (TMI) with the constraints:
  - a set of flights wish to depart an airport;
  - each flight may only take off from certain runways;
  - each flight has a preferred take off time;
  - each flight has an acceptable take off window;
  - only certain runways are available;
  - runways have a maximum rate at which departures can take place;
  - the TMI runs for a specific time interval.

Within these constraints, the goal is to allocate a take off time and runway to flights
in an optimal manner. This model is making use of some of the newer language features such as set1.


Language Version: vdm10
Entry point     : Set`sum({1,2,3,4,5,6,7,8,9})