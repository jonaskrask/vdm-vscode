Author: Nick Battle


This example was produced by Nick Battle and it is used in the VDMJ user
manual to illustrate different features of VDMJ. It models the behaviour
of the 32-bit shared memory quadrants of HP-UX, using a record type M to 
represent a block of memory which is either <FREE> or <USED>, and a 
sequence of M records to represent a Quadrant.

The specification output indicates which allocation policy, first-fit or 
best-fit (or neither), produces the most memory fragmentation.


Language Version: vdm10
Entry point     : M`main(5,100)