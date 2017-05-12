import { MultiSigConfigByNetwork } from '../../util/types';

export const multiSig: MultiSigConfigByNetwork = {
  kovan: {
    owners: [
      '0x005a3539249912F3614540cB6BAD0CAcC9a3e365', // Fabio
      '0xc6b1a8dbe76f0c63f1b5ddb1939f7ddd2d1232af', // Amir
      '0x48f3b8871c0da97c2db6ec35e0961fC269870d63', // Will
    ],
    confirmationsRequired: 1,
    secondsRequired: 3600,
  },
};
