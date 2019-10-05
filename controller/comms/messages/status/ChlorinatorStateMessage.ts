﻿import {Inbound, Protocol} from "../Messages";
import {state} from "../../../State";
import {sys, ControllerType} from "../../../Equipment";

export class ChlorinatorStateMessage {
    public static process(msg: Inbound) {
        if (!state.isInitialized) return;
        if (msg.protocol === Protocol.Chlorinator) {
            if (msg.datalen === 3) {
                let chlorId = msg.extractPayloadByte(0) - 79;
                let chlor = state.chlorinators.getItemById(chlorId, true);
                if (typeof chlor.lastComm === 'undefined') chlor.lastComm = new Date(1970, 0, 1, 0, 0, 0, 0).getTime();
                // The address of the chlorinator will be 81 for the second one 82 for the 3rd ...etc.
                switch (msg.extractPayloadByte(1)) {
                    case 0:
                        break;
                    case 1:
                        // are we getting case 1?
                        1 === 1;
                        break;
                    case 17: {
                            let c = sys.chlorinators.getItemById(chlorId, true);
                            chlor.currentOutput = msg.extractPayloadByte(2);
                            // chlor.body = c.body;
                            // chlor.poolSetpoint = c.poolSetpoint;
                            // chlor.spaSetpoint = c.spaSetpoint;
                            // chlor.superChlorHours = c.superChlorHours;
                            // chlor.superChlor = c.superChlor;
                            if (state.body === 6) chlor.targetOutput = c.poolSetpoint = msg.extractPayloadByte(2);
                            else if (state.body === 1) chlor.targetOutput = c.spaSetpoint = msg.extractPayloadByte(2);
                            if (chlor.currentOutput === 0 && chlor.status !== 128 && (chlor.lastComm + (20 * 1000) < new Date().getTime())) {
                                // We have not talked to the chlorinator in 20 seconds so we have lost communication.
                                chlor.status = 128;
                            }
                            break;
                        }
                    case 18: {
                        chlor.currentOutput = msg.extractPayloadByte(2);
                        chlor.saltLevel = msg.extractPayloadByte(2) * 50;
                        chlor.status = (msg.extractPayloadByte(3) & 0x007F); // Strip off the high bit.  The chlorinator does not actually report this. 
                        break;
                    }
                    case 20: {
                        let c = sys.chlorinators.getItemById(chlorId, true);
                        chlor.type = c.type = msg.extractPayloadByte(2);
                        break;
                    }
                    case 21: {
                            let c = sys.chlorinators.getItemById(chlorId, true);
                            if (state.body === 6) chlor.targetOutput = c.poolSetpoint = msg.extractPayloadByte(2) / 10;
                            else if (state.body === 1) chlor.targetOutput = c.spaSetpoint = msg.extractPayloadByte(2) / 10;
                            break;
                        }
                }
            }
            else if (msg.datalen === 4) {
                let chlor = state.chlorinators.getItemById(msg.extractPayloadByte(0) + 1, true);
                switch (msg.extractPayloadByte(1)) {
                    case 18:
                        chlor.saltLevel = msg.extractPayloadByte(2) * 50;
                        chlor.status = (msg.extractPayloadByte(3) & 0x007F); // Strip off the high bit.  The chlorinator does not actually report this.
                        chlor.lastComm = new Date().getTime();
                        break;
                }
            }
            else if (msg.datalen === 19) {
                //                  I   n    t    e    l    l    i    c   h    l    o    r    -   -   4   0
                //[16, 2][0, 3, 0, 73, 110, 116, 101, 108, 108, 105, 99, 104, 108, 111, 114, 45, 45, 52, 48][188, 16, 3]
                // This is the model number of the chlorinator and the address is actually the second byte.
                let chlor = state.chlorinators.getItemById(msg.extractPayloadByte(0) + 1, true);
                //chlor.saltLevel = msg.extractPayloadByte(2) * 50;
                chlor.name = msg.extractPayloadString(3, 16);
            }
            state.emitEquipmentChanges();
        }
        // question: does IntelliCenter ever broadcast Chlorinator packet?  Answer: Never.  My guess is that this is actually 
        // a configuration message rather than a status message.  Also, IntelliCenter has a 204 extension status that contains
        // the current countdown timer for the superChlor in the last 2 bytes.  Perhaps this is the equivalent.
        else if (msg.protocol === Protocol.Broadcast) {
            // sample packet
            // [165,33,15,16,25,22],[1,10,128,29,132,0,73,110,116,101,108,108,105,99,104,108,111,114,45,45,52,48],[7,231]
            let chlorId = 1;
            let chlor = sys.chlorinators.getItemById(chlorId, true);
            // installed = (aaaaaaa)1 so 1 = installed
            chlor.isActive = (msg.extractPayloadByte(0) & 0x01) === 1;
            if (chlor.isActive) {
                chlor.body = 32; // any body
                // outputSpaPercent field is aaaaaaab (binary) where aaaaaaa = % and b===installed (0=no,1=yes)
                // eg. a value of 41 is 00101001
                // spa percent = 0010100(b) so 10100 = 20
                chlor.spaSetpoint = msg.extractPayloadByte(0) >> 1;
                chlor.poolSetpoint = msg.extractPayloadByte(1);
                chlor.superChlor = msg.extractPayloadByte(5) > 0;
                chlor.superChlorHours = msg.extractPayloadByte(5);
                chlor.name = msg.extractPayloadString(6, 16);
                let schlor = state.chlorinators.getItemById(chlorId, true);
                schlor.saltLevel = msg.extractPayloadByte(3) * 50;
                schlor.status = msg.extractPayloadByte(4) & 0x007F; // Strip off the high bit.  The chlorinator does not actually report this.;
                schlor.lastComm = new Date().getTime();  // rely solely on "true" chlor messages for this?
                schlor.poolSetpoint = chlor.poolSetpoint;
                schlor.spaSetpoint = chlor.spaSetpoint;
                schlor.superChlor = chlor.superChlor;
                schlor.superChlorHours = chlor.superChlorHours;
                schlor.name = chlor.name;
                schlor.body = chlor.body;
                if (state.body === 6) schlor.targetOutput = chlor.poolSetpoint;
                else if (state.body === 1) schlor.targetOutput = chlor.spaSetpoint;
            }
        }
    }
}