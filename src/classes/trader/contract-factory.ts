// contract-factory.ts - Factory for creating contract parameters
/**
 * @file Factory for creating contract parameters
 */

import { ContractParams, PurchaseType } from './types';

/**
 * Factory class for creating different types of contract parameters
 */
export class ContractParamsFactory {
    /**
     * Creates parameters for a DIGITDIFF contract
     */
    static createDigitDiffParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        predictedDigit: number
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "DIGITDIFF",
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: predictedDigit.toString()
        };
    }

    /**
     * Creates parameters for a DIGITOVER contract
     */
    static createDigitOverParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        barrier: number
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "DIGITOVER",
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: barrier.toString()
        };
    }

    /**
     * Creates parameters for a DIGITUNDER contract
     */
    static createDigitUnderParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        barrier: number
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "DIGITUNDER",
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: barrier.toString()
        };
    }

    /**
     * Creates parameters for a EVEN contract
     */
    static createDigitEvenParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "EVEN",
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: "EVEN"
        };
    }

    /**
     * Creates parameters for a ODD contract
     */
    static createDigitOddParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "ODD",
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: "ODD"
        };
    }

    /**
     * Creates parameters for a DIGITOVER 0 contract
     */
    static createDigitOver0Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitOverParams(stake, currency, duration, durationUnit, market, 0);
    }

    /**
     * Creates parameters for a DIGITOVER 1 contract
     */
    static createDigitOver1Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitOverParams(stake, currency, duration, durationUnit, market, 1);
    }

    /**
     * Creates parameters for a DIGITOVER 2 contract
     */
    static createDigitOver2Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitOverParams(stake, currency, duration, durationUnit, market, 2);
    }

    /**
     * Creates parameters for a DIGITUNDER 9 contract
     */
    static createDigitUnder9Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitUnderParams(stake, currency, duration, durationUnit, market, 9);
    }

    /**
     * Creates parameters for a DIGITUNDER 8 contract
     */
    static createDigitUnder8Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitUnderParams(stake, currency, duration, durationUnit, market, 8);
    }

    /**
     * Creates parameters for a DIGITUNDER 7 contract
     */
    static createDigitUnder7Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitUnderParams(stake, currency, duration, durationUnit, market, 7);
    }

    /**
     * Creates parameters for a recovery DIGITUNDER contract
     */
    static createRecoveryDigitUnderParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        barrier: number
    ): ContractParams {
        return {
            amount: stake * 12.37345, // Recovery multiplier
            basis: "stake",
            contract_type: "DIGITUNDER",
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: barrier.toString()
        };
    }
}