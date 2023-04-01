import { Cbor } from "../../../../cbor/Cbor";
import { CborArray } from "../../../../cbor/CborObj/CborArray";
import { CborBytes } from "../../../../cbor/CborObj/CborBytes";
import { CborMap } from "../../../../cbor/CborObj/CborMap";
import { forceCborString } from "../../../../cbor/CborString";
import { ExBudget } from "../../../../onchain/CEK/Machine/ExBudget";
import { DataI, dataToCborObj } from "../../../../types/Data";
import * as uint8Array from "@harmoniclabs/uint8array-utils";
import { costModelsFromCborObj, costModelsToLanguageViewCbor, defaultV2Costs } from "../../../ledger/CostModels";
import { Tx } from "../../Tx";
import { TxRedeemer, TxRedeemerTag } from "../../TxWitnessSet";
import { getScriptDataHash } from "../TxBuilder";

describe("getScriptDataHash", () => {

    test.skip("from real tx (v1?)", () => {

        const txCborHex = "84a70081825820473899cb48414442ea107735f7fc3e020f0293122e9d05e4be6f03ffafde5a0c00018283581d71aba3c2914116298a146af57d8156b1583f183fc05c0aa48ee95bec71821a001c41caa1581c6bec713b08a2d7c64baa3596d200b41b560850919d72e634944f2d52a14f537061636542756442696433303533015820f7f2f57c58b5e4872201ab678928b0d63935e82d022d385e1bad5bfe347e89d8825839015627217786eb781fbfb51911a253f4d250fdbfdcf1198e70d35985a9a013112333b21ec5063ae54f31b0ea883635b64530b70785a49c95041a040228dd021a000db2d907582029ed935cc80249c4de9f3e96fdcea6b7da123a543bbe75fffe9e2c66119e426d0b582039249ec62e53b77ff197bf6821548157b14d56ef63ec3a0b233180e3ae4241740d81825820a90a895d07049afc725a0d6a38c6b82218b8d1de60e7bd70ecdd58f1d9e1218b000e81581c5627217786eb781fbfb51911a253f4d250fdbfdcf1198e70d35985a9a40081825820c9b539dea76713f036285a9c89d164ad929597367a5572c9911832f12fffe0235840bb7d26b65a15f9aa917663178d27e2f16a59bbd4aafe067090dcb60826a585d2b81bf6f25136f5c74fdf78fefcd1928ac6e03d28d13da10de1c03b185e697301038159194059193d010000332332233223232333332222233332222332232333222323332223233333333222222223233322232333322223232332232333222323332223232332233223232333332222233223322332233223322332222323223223232533530343330093333573466e1d401920042304e3055357426aae7940208cccd5cd19b875007480088c140c158d5d09aab9e500923333573466e1d40212000204f235058353059335738921035054310005a49926499263333573466e1d40112006205223333573466e1d40152004205523333573466e1d40192002205323333573466e1d401d2000205623505935305a3357389201035054310005b4992649926498cccd5cd19b8735573aa004900011980619191919191919191919191999ab9a3370e6aae75402920002333333333301a335028232323333573466e1cd55cea8012400046604060766ae854008c0b4d5d09aba25002235066353067335738921035054310006849926135573ca00226ea8004d5d0a80519a8140149aba150093335502f75ca05c6ae854020ccd540bdd728171aba1500733502804435742a00c66a05066aa0aa09aeb4d5d0a8029919191999ab9a3370e6aae754009200023350223232323333573466e1cd55cea80124000466a05466a086eb4d5d0a80118241aba135744a00446a0d46a60d666ae712401035054310006c49926135573ca00226ea8004d5d0a8011919191999ab9a3370e6aae7540092000233502833504375a6ae854008c120d5d09aba2500223506a35306b3357389201035054310006c49926135573ca00226ea8004d5d09aba250022350663530673357389201035054310006849926135573ca00226ea8004d5d0a80219a8143ae35742a00666a05066aa0aaeb88004d5d0a801181d1aba135744a00446a0c46a60c666ae71241035054310006449926135744a00226ae8940044d5d1280089aba25001135744a00226ae8940044d5d1280089aba25001135573ca00226ea8004d5d0a8011919191999ab9a3370ea00290031180f981e1aba135573ca00646666ae68cdc3a801240084603c608c6ae84d55cf280211999ab9a3370ea00690011180f18189aba135573ca00a46666ae68cdc3a80224000460426eb8d5d09aab9e500623505d35305e3357389201035054310005f49926499264984d55cea80089baa001357426ae8940088d4158d4c15ccd5ce2490350543100058499261057135055353056335738920103505435000574984d55cf280089baa001135573a6ea80044d55cea80089baa0012212330010030022001222222222212333333333300100b00a00900800700600500400300220012212330010030022001122123300100300212001122123300100300212001122123300100300212001212222300400521222230030052122223002005212222300100520011232230023758002640026aa080446666aae7c004940388cd4034c010d5d080118019aba200203f23232323333573466e1cd55cea801a4000466600e6464646666ae68cdc39aab9d5002480008cc034c0c4d5d0a80119a8098169aba135744a00446a0846a608666ae712401035054310004449926135573ca00226ea8004d5d0a801999aa805bae500a35742a00466a01eeb8d5d09aba2500223503e35303f335738921035054310004049926135744a00226aae7940044dd50009110919980080200180110009109198008018011000899aa800bae75a224464460046eac004c8004d540e888c8cccd55cf80112804919a80419aa81718031aab9d5002300535573ca00460086ae8800c0e84d5d08008891001091091198008020018900089119191999ab9a3370ea002900011a80418029aba135573ca00646666ae68cdc3a801240044a01046a06a6a606c66ae7124010350543100037499264984d55cea80089baa001121223002003112200112001232323333573466e1cd55cea8012400046600c600e6ae854008dd69aba135744a00446a05e6a606066ae71241035054310003149926135573ca00226ea80048848cc00400c00880048c8cccd5cd19b8735573aa002900011bae357426aae7940088d40acd4c0b0cd5ce2481035054310002d499261375400224464646666ae68cdc3a800a40084a00e46666ae68cdc3a8012400446a014600c6ae84d55cf280211999ab9a3370ea00690001280511a8171a981799ab9c490103505431000304992649926135573aa00226ea8004484888c00c0104488800844888004480048c8cccd5cd19b8750014800880188cccd5cd19b8750024800080188d4098d4c09ccd5ce2490350543100028499264984d55ce9baa0011220021220012001232323232323333573466e1d4005200c200b23333573466e1d4009200a200d23333573466e1d400d200823300b375c6ae854014dd69aba135744a00a46666ae68cdc3a8022400c46601a6eb8d5d0a8039bae357426ae89401c8cccd5cd19b875005480108cc048c050d5d0a8049bae357426ae8940248cccd5cd19b875006480088c050c054d5d09aab9e500b23333573466e1d401d2000230133016357426aae7940308d40acd4c0b0cd5ce2481035054310002d49926499264992649926135573aa00826aae79400c4d55cf280109aab9e500113754002424444444600e01044244444446600c012010424444444600a010244444440082444444400644244444446600401201044244444446600201201040024646464646666ae68cdc3a800a400446660106eb4d5d0a8021bad35742a0066eb4d5d09aba2500323333573466e1d400920002300a300b357426aae7940188d4070d4c074cd5ce249035054310001e499264984d55cea80189aba25001135573ca00226ea80048488c00800c888488ccc00401401000c80048c8c8cccd5cd19b875001480088c018dd71aba135573ca00646666ae68cdc3a80124000460106eb8d5d09aab9e500423501635301733573892010350543100018499264984d55cea80089baa001212230020032122300100320011122232323333573466e1cd55cea80124000466aa010600c6ae854008c014d5d09aba25002235013353014335738921035054310001549926135573ca00226ea8004448848cc00400c00844800484888c00c01084888c00801048880048004488880104888800c488880084888800480048c8c8c8cccd5cd19b8735573aa006900011999111998068018010009bae35742a0066eb8d5d0a8011bad357426ae8940088d4018d4c01ccd5ce2481035054310000849926135744a00226aae7940044dd5000893090009000911091998008020018011000889191800800911980198010010009991999111919191991199991111991199911191919191919991119911919191919199999111119191919191999111999111999999991111111199119999911111991191919191991199119911919999111199119911991199119911919191919191991199119191919191919191919999111199119191191919191919111191919191919192999a983d80510a9999a9831805099835199a8342839183f8009a9aa83d280311000998351991199ab9a3371200400211202110026603860bea00460506a604802444444444400260bea00a660d46601aa00a60c4002a66a610a026603aa010603e002210e0226605260be66026a010603e00260bea0042c2660d46603aa010603e002660d4666a0d0a0e46a6aa0f4a00c440020fa6601aa00a60c40022660d4666a0d0a0e46a6aa0f4a00c440020fa660d46601aa00a60c4002660d46601866026a010603e00260c4002660086a05460bea004a00642a6666a60c60142c2660d46601866026a010a00660c4002660d46605260420026046024660086042002603e00226603aa010603e0022c2a6666a60c40122a66a6108026644666ae68cdc4801000843808440098082800a40042a66a6a0ec605401026102022c442a66a6a0f000226106022c46442a66a6a0f600226a6aa0fc6a6aa0fca0044400444a666a61040200242660e26602800660d2002660e2660606a06260cc0066054032660e2666a0de0ca605000290011a9aa840809a9aa84080a80291000912999a98428080090b10b0999a83883399814980d2805a4004603400442c2660e0666a0dc0c86604c602ea0109001180b8011a9aa840009a9aa84000a80211000912999a98420080090998399980b001983580099839998191a8199834001981600d999a8388339815000a400442c2c4426110022c266aa0fa601200660120022a66a6a0ec605401026104022c4646442a66a6a0f40022a666a60fe6a6aa0faa0064400242660dc66022a00660cc002660dc6605a6a05c60c6a006604e02c666a0d80c4604a002900110b0b1109844008b09a9aa83da80091001098038008b0b0b0a99a9a8369a9816003911a981800111111111111982300500590980e9a981e000910008b0a99a9a83a191a98170009111111111001a802898390b110a99a9a83b0008801110983b0b1191919191299a98438099815803241012179fa042660d86605660c26602aa014a0226054a004660d86605660c26602aa0146a6aa0f8a020440046054a0066605660c26602aa014002605466044660446604400ca004a0066a6aaa050a0084440022660d86605660c26602aa014a0226054a00a6605660c26602aa01400260546604400ca00a26a6aaa04ca00444400626a6aaa04aa0024440042666aaa04a660e40046a6aaa048a01c444002660e40046a6aa0f0a01844002660e40046a60440204444444440062660e20026a6aaa046a01a44400426a6aa0eaa002440042a66a6a0e2604a006260e02c442a66a6a0e60022600600444260e82c46a60766a60720024440064466a60ae0044c4a66a6a0d86a607800844400242a66a6a0da646a605e0024444444444a66a6a0f0666aa609824002a09e46a6aa1080200244a66a612202666ae68cdc7801007849808490089a83e8018a83e001109a83d9a9aa84200800910008a83ca80311919190a99a9a8389999999aba400423333573466e1d40092004233335573ea0084a0ea46666aae7cd5d128029299a9a83a98389aba150062135078308501001150762507607307223333573466e1d400d2002233335573ea00a4a0ec46666aae7cd5d128031299a9a83b18391aba150072135079308701001150772507707407323333573466e1d40112000233335573ea00c46a0f0108024a0ee0e84a0ec9324c93128399283992839928398381099aa83f18108050008b09aab9d5002135573ca00226ea800458584d4c0980048800888cc07cccc158008d4c068020888888888024ccd417dc51a980d004111111111003800a4004446603c6660aa004602e00e666a0bce28d4c06401c8888888880180052002135301600422222222200413535550175001222003135301400222222222200523322300200132233200132001333550023233503b22333503a0030010023503700133503a22230033002001200122337000029001000a400060662400266466aa603a2400244a66a60f06006004266a0d60040022002a0d446a6aaa02e002444660bc666a0b8042602c00c006666a0b80a400290011919a800a834a835091199aa829911a9aa83700111199aa82b911a9aa83900111299a983f999ab9a3370e002900004080840008801899805199aaa81080300100080180180080080191199aa980d890009119aa98060900091a9aa8360009119aa83780119aa98078900091a9aa8378009119aa839001199a9aa80700091980a24000002446602a004002466028002900000099aa98060900091a9aa8360009119aa837801199a9aa805800919aa98080900091a9aa8380009119aa8398011aa80900080091199aaa805011801000919aa98080900091a9aa8380009119aa8398011aa808000800999aaa80280f001000a8341a980f8011111111111199aa981289000911a981d0011111a981f8019119a982d8011299a984300999ab9a3371e0260021100210e02266a0f200a00e200e400ea0e4012222444666aa603624002a0ce66aa60142400246a6aa0d40024466aa0da0046aa018002666aa603624002446a6aa0d600444a66a60f0666aa606c240026466a07844666a6a016006440040040026a6a0120024400266a01244a66a60f400420f820020f246a6aa0dc002446601400400a00c2006266a0d6008006a0d000266aa60142400246a6aa0d4002446466aa0dc006600200a640026aa0f444a66a6a0d600226aa0180064426a6aa0e000444a66a60fa66018004010266aa02200e0022600c00600424424660020060042400222424446006008224424446600400a00822424446002008224002640026aa0da442244a66a6a0c00022a0c444266a0c6600800466aa600c240020080024466e0000800488d4c05400888888888894cd4d4178ccd54c0c84800540d494cd4c1d4ccd5cd19b8f00c0010770761350610011506000321077107523530220012220022353062001222003223370200400246a60c000244400246a600600244444444401046a60040024444444440044444444442466666666600201401201000e00c00a0080060044002222444246660020080060042224002400244666ae68cdc400100082f8300900091a9802000911a98040011111111111299a9a8289980f005005909a9810000911a9812000911199aa980a09000911a98148011111a9817004111a98180029119299a983b99a9826802919a98270021299a983c999ab9a3371e0040020f60f42a00620f440f4466a609c00840f44a66a60f2666ae68cdc780100083d83d0a801883d099a83500500488048a99a9a83000190a99a9a8308011099a9825801119a9826001119a9828001119a9828801119812001000903e919a9828801103e91981200100091103e91119a9827002103e911299a983f199ab9a3370e00c006100020fe2a66a60fc666ae68cdc38028010400083f89982b802000883f883f883c0a99a9a8300009083c083c283080789931a982799ab9c4901024c6600050498c8004d5417088448894cd4d41400044008884cc014008ccd54c01c4800401401000488ccd5cd19b8f00200105c05b2212330010030022001222222222212333333333300100b00a0090080070060050040030022001122123300100300212001122123300100300212001122123300100300212001121222300300411222002112220011200122533335300f0012150372150372150372133355300a12001500d2353005001225335304f5335304f333573466e3cd4c06000888008d4c060010880081441404ccd5cd19b873530180022200135301800422001051050105013503b0031503a003221233001003002200122212333001004003002200122123300100300220013200135504522112225335350390011350060032213335009005300400233355300712001005004001123535004001220011235350030012200213350022253353502b002210031001502a12212330010030021200121222230040052122223003005212222300200521222230010052001221233001003002200121222222230070082212222222330060090082122222223005008122222220041222222200322122222223300200900822122222223300100900820012122300200322212233300100500400320012122300200321223001003200122333573466e1c0080040ac0a88ccc00800522100488100222323230010053200135502c223353501d0014800088d4d54088008894cd4c0bcccd5cd19b8f00200903103013007001130060033200135502b223353501c0014800088d4d54084008894cd4c0b8ccd5cd19b8f00200703002f100113006003112232001320013550292253353501a0011003221330060023004001235301f0012220021222200412222003122220021222200120011200112001225335301d0021001101e2323232323333333574800a46666ae68cdc39aab9d5005480008cccd55cfa8029280691999aab9f50052500e233335573ea00a4a01e46666aae7cd5d128031299a9a807a99a9a807a99a9a80798061aba150092135012223330240030020011501021533535010300d35742a012426a02660040022a0222a02042a66a6a020646666666ae900049404c9404c9404c8d4050dd6801128098081aba150082135013300200115011150102501000d00c00b00a2500c4989402c9402c9402c9402c0204d5d1280089aba25001135573ca00226ea80048ccccccd5d20009280312803128031280311a8039bae00200312001200112122300200311220011200112253335300c0022153335300d00221330050020012130161613015162153335300d0022130161621330050020011301516153335300c001213015162130151610172253353014333573466e3cd4c03c008888008d4c03c0048880080580544ccd5cd19b8735300f00222200135300f00122200101601510152233223370600400266e080092014001262611220021221223300100400312001112212330010030021120012122230030042122230020041222001200122212333001004003002200126262612200212200120011123230010012233003300200200133223322332233333333300248811cd5e6bf0500378d4f0da4e8dde6becec7621cd8cbf5cbb9b87013d4cc0048811c6bec713b08a2d7c64baa3596d200b41b560850919d72e634944f2d520048810853706163654275640048810b5370616365427564426964003335550044891c826d9fafe1b3acf15bd250de69c04e3fc92c4493785939e069932e8900483001920e209335500648811c88269f8b051a739300fe743a7b315026f4614ce1216a4bb45d7fd0f500482209d20882748203db810920a09c012222222221233333333300100a00900800700600500400300220011112221233300100400300211120011122123300100300211200110482d866820181d866820083581c5627217786eb781fbfb51911a253f4d250fdbfdcf1198e70d35985a9443330353301d8668200800581840000d866820380821a004c4b401a77359400f5a1190195a10045d866820080";

        const tx = Tx.fromCbor( txCborHex );

        console.log(
            JSON.stringify(
                tx.witnesses.redeemers?.map( r => r.toJson() ),
                undefined,
                2
            )
        );
        console.log(
            JSON.stringify(
                tx.witnesses.datums?.map( r => r.toJson() ),
                undefined,
                2
            )
        );

        console.log(
            JSON.stringify(
                tx.witnesses.toJson(),
                undefined,
                2
            )
        );

        console.log( tx.witnesses.toCbor().toString() );
        console.log( Cbor.encode(
            new CborArray(
                tx.witnesses.redeemers?.map( r => r.toCborObj() ) ?? []
            )
        ).toString() );
        console.log( Cbor.encode(
            new CborArray(
                tx.witnesses.datums?.map( dataToCborObj ) ?? []
            )
        ).toString() );


        console.log( "ScriptDataHash: ", tx.body.scriptDataHash?.toString() );

        console.log( "mine: ", getScriptDataHash(
            tx.witnesses.redeemers ?? [],
            Array.from(
                Cbor.encode(
                    new CborArray(
                        tx.witnesses.datums?.map( dataToCborObj ) ?? []
                    )
                ).toBuffer()
            ),
            costModelsToLanguageViewCbor(
                {
                    PlutusScriptV2: defaultV2Costs
                },
                { mustHaveV2: true }
            ).toBuffer()
        )?.toString() );

    });

    test("from real tx 2", () => {

        const txCborHex = "84a800818258209130e089ed641505d2b50c47acec7ed65bdb01242863af95635aa685403e5777010182825839005867c3b8e27840f556ac268b781578b14c5661fc63ee720dbeab663f9d4dcd7e454d2434164f4efb8edeb358d86a1dad9ec6224cfcbce3e6821a0011b0dea1581c9c8e9da7f81e3ca90485f32ebefc98137c8ac260a072a00c4aaf142da1494d657368546f6b656e01825839005867c3b8e27840f556ac268b781578b14c5661fc63ee720dbeab663f9d4dcd7e454d2434164f4efb8edeb358d86a1dad9ec6224cfcbce3e61b0000000117e2f60c021a000dad69075820f056733df18be2b7978552918c616651b501a2d95c571f272570e083d027d15f09a1581c9c8e9da7f81e3ca90485f32ebefc98137c8ac260a072a00c4aaf142da1494d657368546f6b656e010b5820df2de8c102f948422412af199867e5d472b9ff700473b2841e63209041b0e7df0d83825820d61b5db3ac78fba423aeb1b8fbf58738572e8a7508d2713985820ef3fa95edfa00825820e0a22aedea6d589242d7606821036d86449d8b5f8d2ec8a843f9fd074e8a20e100825820ee3094317fc8593747f897763d077498cdc5ed74333acb9e88d5303e93e72a67000e81581c5867c3b8e27840f556ac268b781578b14c5661fc63ee720dbeab663fa3038006815907655907620100003232323232323232323232323232332232323232322232325335320193333573466e1cd55cea80124000466442466002006004646464646464646464646464646666ae68cdc39aab9d500c480008cccccccccccc88888888888848cccccccccccc00403403002c02802402001c01801401000c008cd4050054d5d0a80619a80a00a9aba1500b33501401635742a014666aa030eb9405cd5d0a804999aa80c3ae501735742a01066a02803e6ae85401cccd54060081d69aba150063232323333573466e1cd55cea801240004664424660020060046464646666ae68cdc39aab9d5002480008cc8848cc00400c008cd40a9d69aba15002302b357426ae8940088c98c80b4cd5ce01701681589aab9e5001137540026ae854008c8c8c8cccd5cd19b8735573aa004900011991091980080180119a8153ad35742a00460566ae84d5d1280111931901699ab9c02e02d02b135573ca00226ea8004d5d09aba2500223263202933573805405204e26aae7940044dd50009aba1500533501475c6ae854010ccd540600708004d5d0a801999aa80c3ae200135742a004603c6ae84d5d1280111931901299ab9c026025023135744a00226ae8940044d5d1280089aba25001135744a00226ae8940044d5d1280089aba25001135744a00226ae8940044d55cf280089baa00135742a004601c6ae84d5d1280111931900b99ab9c018017015101613263201633573892010350543500016135573ca00226ea800448c88c008dd6000990009aa80a911999aab9f0012500a233500930043574200460066ae880080508c8c8cccd5cd19b8735573aa004900011991091980080180118061aba150023005357426ae8940088c98c8050cd5ce00a80a00909aab9e5001137540024646464646666ae68cdc39aab9d5004480008cccc888848cccc00401401000c008c8c8c8cccd5cd19b8735573aa0049000119910919800801801180a9aba1500233500f014357426ae8940088c98c8064cd5ce00d00c80b89aab9e5001137540026ae854010ccd54021d728039aba150033232323333573466e1d4005200423212223002004357426aae79400c8cccd5cd19b875002480088c84888c004010dd71aba135573ca00846666ae68cdc3a801a400042444006464c6403666ae7007006c06406005c4d55cea80089baa00135742a00466a016eb8d5d09aba2500223263201533573802c02a02626ae8940044d5d1280089aab9e500113754002266aa002eb9d6889119118011bab00132001355012223233335573e0044a010466a00e66442466002006004600c6aae754008c014d55cf280118021aba200301213574200222440042442446600200800624464646666ae68cdc3a800a40004642446004006600a6ae84d55cf280191999ab9a3370ea0049001109100091931900819ab9c01101000e00d135573aa00226ea80048c8c8cccd5cd19b875001480188c848888c010014c01cd5d09aab9e500323333573466e1d400920042321222230020053009357426aae7940108cccd5cd19b875003480088c848888c004014c01cd5d09aab9e500523333573466e1d40112000232122223003005375c6ae84d55cf280311931900819ab9c01101000e00d00c00b135573aa00226ea80048c8c8cccd5cd19b8735573aa004900011991091980080180118029aba15002375a6ae84d5d1280111931900619ab9c00d00c00a135573ca00226ea80048c8cccd5cd19b8735573aa002900011bae357426aae7940088c98c8028cd5ce00580500409baa001232323232323333573466e1d4005200c21222222200323333573466e1d4009200a21222222200423333573466e1d400d2008233221222222233001009008375c6ae854014dd69aba135744a00a46666ae68cdc3a8022400c4664424444444660040120106eb8d5d0a8039bae357426ae89401c8cccd5cd19b875005480108cc8848888888cc018024020c030d5d0a8049bae357426ae8940248cccd5cd19b875006480088c848888888c01c020c034d5d09aab9e500b23333573466e1d401d2000232122222223005008300e357426aae7940308c98c804ccd5ce00a00980880800780700680600589aab9d5004135573ca00626aae7940084d55cf280089baa0012323232323333573466e1d400520022333222122333001005004003375a6ae854010dd69aba15003375a6ae84d5d1280191999ab9a3370ea0049000119091180100198041aba135573ca00c464c6401866ae700340300280244d55cea80189aba25001135573ca00226ea80048c8c8cccd5cd19b875001480088c8488c00400cdd71aba135573ca00646666ae68cdc3a8012400046424460040066eb8d5d09aab9e500423263200933573801401200e00c26aae7540044dd500089119191999ab9a3370ea00290021091100091999ab9a3370ea00490011190911180180218031aba135573ca00846666ae68cdc3a801a400042444004464c6401466ae7002c02802001c0184d55cea80089baa0012323333573466e1d40052002200723333573466e1d40092000212200123263200633573800e00c00800626aae74dd5000a4c24002920103505431001220021123230010012233003300200200110581840100d87980821a006acfc01ab2d05e00f5a11902d1a178383963386539646137663831653363613930343835663332656265666339383133376338616332363061303732613030633461616631343264a1694d657368546f6b656ea46b6465736372697074696f6e783154686973204e4654206973206d696e746564206279204d657368202868747470733a2f2f6d6573686a732e6465762f292e65696d6167657835697066733a2f2f516d527a6963705265757477436b4d36616f74754b6a4572464355443231334470775071364279757a4d4a617561696d656469615479706569696d6167652f6a7067646e616d656a4d65736820546f6b656e";

        const tx = Tx.fromCbor( txCborHex );

        const datumsScriptData = tx.witnesses.datums === undefined ? [] : Array.from(
                Cbor.encode(
                    new CborArray(
                        tx.witnesses.datums.map( dataToCborObj ) ?? []
                    )
                ).toBuffer()
            )

        const txCostModels = costModelsFromCborObj(
            Cbor.parse(
                forceCborString( "a20098a61a0003236119032c01011903e819023b00011903e8195e7104011903e818201a0001ca761928eb041959d818641959d818641959d818641959d818641959d818641959d81864186418641959d81864194c5118201a0002acfa182019b551041a000363151901ff00011a00015c3518201a000797751936f404021a0002ff941a0006ea7818dc0001011903e8196ff604021a0003bd081a00034ec5183e011a00102e0f19312a011a00032e801901a5011a0002da781903e819cf06011a00013a34182019a8f118201903e818201a00013aac0119e143041903e80a1a00030219189c011a00030219189c011a0003207c1901d9011a000330001901ff0119ccf3182019fd40182019ffd5182019581e18201940b318201a00012adf18201a0002ff941a0006ea7818dc0001011a00010f92192da7000119eabb18201a0002ff941a0006ea7818dc0001011a0002ff941a0006ea7818dc0001011a000c504e197712041a001d6af61a0001425b041a00040c660004001a00014fab18201a0003236119032c010119a0de18201a00033d7618201979f41820197fb8182019a95d1820197df718201995aa18201a0374f693194a1f0a0198af1a0003236119032c01011903e819023b00011903e8195e7104011903e818201a0001ca761928eb041959d818641959d818641959d818641959d818641959d818641959d81864186418641959d81864194c5118201a0002acfa182019b551041a000363151901ff00011a00015c3518201a000797751936f404021a0002ff941a0006ea7818dc0001011903e8196ff604021a0003bd081a00034ec5183e011a00102e0f19312a011a00032e801901a5011a0002da781903e819cf06011a00013a34182019a8f118201903e818201a00013aac0119e143041903e80a1a00030219189c011a00030219189c011a0003207c1901d9011a000330001901ff0119ccf3182019fd40182019ffd5182019581e18201940b318201a00012adf18201a0002ff941a0006ea7818dc0001011a00010f92192da7000119eabb18201a0002ff941a0006ea7818dc0001011a0002ff941a0006ea7818dc0001011a0011b22c1a0005fdde00021a000c504e197712041a001d6af61a0001425b041a00040c660004001a00014fab18201a0003236119032c010119a0de18201a00033d7618201979f41820197fb8182019a95d1820197df718201995aa18201a0223accc0a1a0374f693194a1f0a1a02515e841980b30a" )
            )
        );

        expect(
            JSON.stringify(
                defaultV2Costs,
                ( _, v ) => typeof v === "number" || typeof v === "bigint" ? v.toString() : v
            )
        ).toEqual(
            JSON.stringify(
                txCostModels.PlutusScriptV2,
                ( _, v ) => typeof v === "number" || typeof v === "bigint" ? v.toString() : v
            )
        )

        expect(
            getScriptDataHash(
                tx.witnesses.redeemers ?? [],
                datumsScriptData,
                costModelsToLanguageViewCbor(
                    txCostModels,
                    {
                        mustHaveV1: false,
                        mustHaveV2: true
                    }
                ).toBuffer()
            )?.toString()
        ).toEqual(
            tx.body.scriptDataHash?.toString()
        )

    });

    test.skip("csl case", () => {

        /*
            #[test]
            fn correct_script_data_hash() {
                let mut datums = PlutusList::new();
                datums.add(&PlutusData::new_integer(&BigInt::from_str("1000").unwrap()));
                let mut redeemers = Redeemers::new();
                redeemers.add(&Redeemer::new(
                    &RedeemerTag::new_spend(),
                    &BigNum::from_str("1").unwrap(),
                    &PlutusData::new_integer(&BigInt::from_str("2000").unwrap()),
                    &ExUnits::new(
                        &BigNum::from_str("0").unwrap(),
                        &BigNum::from_str("0").unwrap(),
                    ),
                ));
                let plutus_cost_model = CostModel::from_bytes(vec![
                    159, 26, 0, 3, 2, 89, 0, 1, 1, 26, 0, 6, 11, 199, 25, 2, 109, 0, 1, 26, 0, 2, 73, 240,
                    25, 3, 232, 0, 1, 26, 0, 2, 73, 240, 24, 32, 26, 0, 37, 206, 168, 25, 113, 247, 4, 25,
                    116, 77, 24, 100, 25, 116, 77, 24, 100, 25, 116, 77, 24, 100, 25, 116, 77, 24, 100, 25,
                    116, 77, 24, 100, 25, 116, 77, 24, 100, 24, 100, 24, 100, 25, 116, 77, 24, 100, 26, 0,
                    2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73,
                    240, 25, 3, 232, 0, 1, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 25, 3, 232, 0, 8,
                    26, 0, 2, 66, 32, 26, 0, 6, 126, 35, 24, 118, 0, 1, 1, 26, 0, 2, 73, 240, 25, 3, 232,
                    0, 8, 26, 0, 2, 73, 240, 26, 0, 1, 183, 152, 24, 247, 1, 26, 0, 2, 73, 240, 25, 39, 16,
                    1, 26, 0, 2, 21, 94, 25, 5, 46, 1, 25, 3, 232, 26, 0, 2, 73, 240, 25, 3, 232, 1, 26, 0,
                    2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 1, 1, 26, 0,
                    2, 73, 240, 1, 26, 0, 2, 73, 240, 4, 26, 0, 1, 148, 175, 24, 248, 1, 26, 0, 1, 148,
                    175, 24, 248, 1, 26, 0, 2, 55, 124, 25, 5, 86, 1, 26, 0, 2, 189, 234, 25, 1, 241, 1,
                    26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0,
                    2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 66,
                    32, 26, 0, 6, 126, 35, 24, 118, 0, 1, 1, 25, 240, 76, 25, 43, 210, 0, 1, 26, 0, 2, 73,
                    240, 24, 32, 26, 0, 2, 66, 32, 26, 0, 6, 126, 35, 24, 118, 0, 1, 1, 26, 0, 2, 66, 32,
                    26, 0, 6, 126, 35, 24, 118, 0, 1, 1, 26, 0, 37, 206, 168, 25, 113, 247, 4, 0, 26, 0, 1,
                    65, 187, 4, 26, 0, 2, 73, 240, 25, 19, 136, 0, 1, 26, 0, 2, 73, 240, 24, 32, 26, 0, 3,
                    2, 89, 0, 1, 1, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73,
                    240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 2, 73, 240,
                    24, 32, 26, 0, 2, 73, 240, 24, 32, 26, 0, 51, 13, 167, 1, 1, 255,
                ])
                    .unwrap();
                let mut cost_models = Costmdls::new();
                cost_models.insert(&Language::new_plutus_v1(), &plutus_cost_model);
                let script_data_hash = hash_script_data(&redeemers, &cost_models, Some(datums));

                assert_eq!(
                    hex::encode(script_data_hash.to_bytes()),
                    "4415e6667e6d6bbd992af5092d48e3c2ba9825200d0234d2470068f7f0f178b3"
                );
            }
        */

        expect(
            getScriptDataHash(
                [
                    new TxRedeemer({
                        tag: TxRedeemerTag.Spend,
                        index: 1,
                        data: new DataI(2000),
                        execUnits: new ExBudget({ mem: 0, cpu: 0 }),
                    })
                ],
                Array.from(
                    Cbor.encode(
                        new CborArray([
                            dataToCborObj( new DataI(1000) )
                        ])
                    ).toBuffer()
                ),
                costModelsToLanguageViewCbor(
                    costModelsFromCborObj(
                        new CborMap([
                            {
                                k: new CborBytes(new Uint8Array([0])),
                                v: Cbor.parse(
                                    uint8Array.fromHex("9f1a000302590001011a00060bc719026d00011a000249f01903e800011a000249f018201a0025cea81971f70419744d186419744d186419744d186419744d186419744d186419744d18641864186419744d18641a000249f018201a000249f018201a000249f018201a000249f01903e800011a000249f018201a000249f01903e800081a000242201a00067e2318760001011a000249f01903e800081a000249f01a0001b79818f7011a000249f0192710011a0002155e19052e011903e81a000249f01903e8011a000249f018201a000249f018201a000249f0182001011a000249f0011a000249f0041a000194af18f8011a000194af18f8011a0002377c190556011a0002bdea1901f1011a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000242201a00067e23187600010119f04c192bd200011a000249f018201a000242201a00067e2318760001011a000242201a00067e2318760001011a0025cea81971f704001a000141bb041a000249f019138800011a000249f018201a000302590001011a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a00330da70101ff")
                                )
                            }
                        ])
                    ),
                    {
                        mustHaveV1: true,
                        mustHaveV2: false
                    }
                ).toBuffer()
            )?.toString()
        ).toEqual(
            "4415e6667e6d6bbd992af5092d48e3c2ba9825200d0234d2470068f7f0f178b3"
        )
    })
});