Author: Peter Gorm Larsen


﻿This document is simply an attempt to model the basic data 
structures and auxiliary functions necessary to represent 
realms. A geometric realm defined here is a planner graph 
over a finite resolution grid. This example have been 
partly tested and the test coverage information is 
displayed on the postscript version of the document. 
The script used for testing is included among the source 
files. Realms are used to represent geographical data. 
This document is based on: 

Realms: A Foundation for Spatial Data Types in Database 
Systems, Ralf Hartmut Güting and Marcus Schneider, 
Advances in Spatial Databases - Third International 
Symposium, SSD'93, Springer-Verlag, June 1993. 

Map Generalisation, Ngo Quoc Tao, UNU/IIST, Macau, 
Draft, January, 1996. 

Language Version: classic
Entry point     : REALM`AllLists({TEST`s1,TEST`s2,TEST`s3})