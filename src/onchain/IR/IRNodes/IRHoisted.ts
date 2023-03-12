import { seahash } from "../../../crypto";
import { Cloneable } from "../../../types/interfaces/Cloneable";
import ObjectUtils from "../../../utils/ObjectUtils";
import { IRTerm } from "../IRTerm";
import { IHash } from "../interfaces/IHash";
import { concatUint8Arr } from "../utils/concatUint8Arr";

export class IRHoisted
    implements Cloneable<IRHoisted>, IHash
{
    readonly hash!: Uint8Array;

    readonly hoisted!: IRTerm

    readonly dependecies!: IRTerm[];

    clone!: () => IRHoisted;

    constructor( hoisted: IRTerm, dependecies: IRTerm[] = [] )
    {
        // TODO check hoisted to be closed.

        ObjectUtils.defineReadOnlyProperty(
            this, "hoisted", hoisted
        );

        let hash: Uint8Array | undefined = undefined;
        Object.defineProperty(
            this, "hash", {
                get: () => {
                    if(!( hash instanceof Uint8Array ))
                    {
                        hash = seahash(
                            concatUint8Arr(
                                IRHoisted.tag,
                                hoisted.hash
                            )
                        )
                    }
                    return hash.slice();
                },
                set: () => {},
                enumerable: true,
                configurable: false
            }
        );

        const deps = dependecies.slice();

        Object.defineProperty(
            this, "dependecies",
            {
                get: () => deps.map( dep => dep.clone() ),
                set: () => {},
                enumerable: true,
                configurable: false
            }
        )
        
        ObjectUtils.defineProperty(
            this, "clone",
            () => {
                return new IRHoisted(
                    this.hoisted.clone(),
                    deps
                );
            }
        );
        
    }

    static get tag(): Uint8Array { return new Uint8Array([ 0b0000_0110 ]); }

    
}