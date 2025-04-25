// contract-factory.ts - Factory for creating contract parameters
/**
 * @file Factory for creating contract parameters
 */

import { getRandomDigit } from '@/common/utils/snippets';
import { ContractParams, BasisTypeEnum, ContractTypeEnum, ContractType, BasisType, CurrenciesEnum, CurrencyType, ContractDurationUnitType, ContractDurationUnitTypeEnum, MarketType, MarketTypeEnum, ContractOptionsParams } from './types';

/**
 * Factory class for creating different types of contract parameters
 */
export class ContractParamsFactory {

    private static amount: number = 1;
    private static basis: BasisType = BasisTypeEnum.Default;
    private static contract_type: ContractType = ContractTypeEnum.Default;
    private static currency: CurrencyType = CurrenciesEnum.Default;
    private static duration: string = "1";
    private static duration_unit: ContractDurationUnitType = ContractDurationUnitTypeEnum.Default;
    private static market: MarketType = MarketTypeEnum.Default;
    
    /**
     * Creates parameters for a DIGITDIFF contract
     */
    static createDefaultParams(): ContractParams {
        return {
            amount: this.amount,
            basis: this.basis,
            contract_type: this.contract_type,
            currency: this.currency,
            duration: this.duration,
            duration_unit: this.duration_unit,
            symbol: this.market,
            barrier: getRandomDigit().toString()
        };
    }

    /**
     * Creates parameters for a DIGITDIFF contract
     */
    static createParams(
        amount: number,
        basis: BasisType,
        contractType: ContractType,
        currency: CurrencyType,
        duration: number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
        barrier: string | number
    ): ContractParams {

        const params: ContractParams = {
            amount: Number(amount.toFixed(2)),
            basis: basis,
            contract_type: contractType,
            currency: currency,
            duration: duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: getRandomDigit().toString()
        };

        if (barrier) {
            params.barrier = barrier;
        }

        return params;

    }

    /**
     * Creates parameters for a DIGITDIFF contract
     */
    static createDigitDiffParams(options: ContractOptionsParams): ContractParams {
        return {
            amount: options.amount || this.amount,
            basis: options.basis || this.basis,
            contract_type: ContractTypeEnum.DigitDiff || this.contract_type,
            currency: options.currency || this.currency,
            duration: options.duration || this.duration,
            duration_unit: options.durationUnit || this.duration_unit,
            symbol: options.market || this.market,
            barrier: options.predictedDigit ? options.predictedDigit.toString() : getRandomDigit().toString()
        };
    }

    /**
     * Creates parameters for a DIGITOVER contract
     */
    static createDigitOverParams(options: ContractOptionsParams): ContractParams {
        return {
            amount: options.amount || this.amount,
            basis: options.basis || this.basis,
            contract_type: ContractTypeEnum.DigitOver || this.contract_type,
            currency: options.currency || this.currency,
            duration: options.duration || this.duration,
            duration_unit: options.durationUnit || this.duration_unit,
            symbol: options.market || this.market,
            barrier: options.predictedDigit ? options.predictedDigit.toString() : getRandomDigit().toString()
        };
    }

    /**
     * Creates parameters for a DIGITUNDER contract
     */
    static createDigitUnderParams(options: ContractOptionsParams): ContractParams {
        return {
            amount: options.amount || this.amount,
            basis: options.basis || this.basis,
            contract_type: ContractTypeEnum.DigitUnder || this.contract_type,
            currency: options.currency || this.currency,
            duration: options.duration || this.duration,
            duration_unit: options.durationUnit || this.duration_unit,
            symbol: options.market || this.market,
            barrier: options.predictedDigit ? options.predictedDigit.toString() : getRandomDigit().toString()
        };
    }

    /**
     * Creates parameters for a DIGITEVEN contract
     */
    static createDigitEvenParams(options: ContractOptionsParams): ContractParams {
        return {
            amount: options.amount || this.amount,
            basis: options.basis || this.basis,
            contract_type: ContractTypeEnum.DigitEven || this.contract_type,
            currency: options.currency || this.currency,
            duration: options.duration || this.duration,
            duration_unit: options.durationUnit || this.duration_unit,
            symbol: options.market || this.market,
            barrier: options.barrier ? options.barrier : ContractTypeEnum.DigitEven.toString()
        };
    }

    /**
     * Creates parameters for a DIGITODD contract
     */
    static createDigitOddParams(options: ContractOptionsParams): ContractParams {
        return {
            amount: options.amount || this.amount,
            basis: options.basis || this.basis,
            contract_type: ContractTypeEnum.DigitOdd || this.contract_type,
            currency: options.currency || this.currency,
            duration: options.duration || this.duration,
            duration_unit: options.durationUnit || this.duration_unit,
            symbol: options.market || this.market,
            barrier: options.barrier ? options.barrier : ContractTypeEnum.DigitOdd.toString()
        };
    }

    /**
     * Creates parameters for a DIGITOVER 0 contract
     */
    static createDigitOver0Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 0,
        }
        return this.createDigitOverParams(options);
    }

    /**
     * Creates parameters for a DIGITOVER 1 contract
     */
    static createDigitOver1Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 1,
        }
        return this.createDigitOverParams(options);
    }

    /**
     * Creates parameters for a DIGITOVER 2 contract
     */
    static createDigitOver2Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 2,
        }
        return this.createDigitOverParams(options);
    }

    /**
     * Creates parameters for a DIGITOVER 3 contract
     */
    static createDigitOver3Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 3,
        }
        return this.createDigitOverParams(options);
    }

    /**
     * Creates parameters for a DIGITOVER 4 contract
     */
    static createDigitOver4Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 4,
        }
        return this.createDigitOverParams(options);
    }

    /**
     * Creates parameters for a DIGITOVER 5 contract
     */
    static createDigitOver5Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 5,
        }
        return this.createDigitOverParams(options);
    }

    /**
     * Creates parameters for a DIGITOVER 6 contract
     */
    static createDigitOver6Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 6,
        }
        return this.createDigitOverParams(options);
    }

    /**
     * Creates parameters for a DIGITOVER 7 contract
     */
    static createDigitOver7Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 7,
        }
        return this.createDigitOverParams(options);
    }

    /**
     * Creates parameters for a DIGITOVER 8 contract
     */
    static createDigitOver8Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 8,
        }
        return this.createDigitOverParams(options);
    }

    /**
     * Creates parameters for a DIGITUNDER 9 contract
     */
    static createDigitUnder9Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 9,
        }
        return this.createDigitUnderParams(options);
    }

    /**
     * Creates parameters for a DIGITUNDER 8 contract
     */
    static createDigitUnder8Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 8,
        }
        return this.createDigitUnderParams(options);
    }

    /**
     * Creates parameters for a DIGITUNDER 7 contract
     */
    static createDigitUnder7Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 7,
        }
        return this.createDigitUnderParams(options);
    }

    /**
     * Creates parameters for a DIGITUNDER 6 contract
     */
    static createDigitUnder6Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 6,
        }
        return this.createDigitUnderParams(options);
    }

    /**
     * Creates parameters for a DIGITUNDER 5 contract
     */
    static createDigitUnder5Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 5,
        }
        return this.createDigitUnderParams(options);
    }

    /**
     * Creates parameters for a DIGITUNDER 4 contract
     */
    static createDigitUnder4Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 4,
        }
        return this.createDigitUnderParams(options);
    }

    /**
     * Creates parameters for a DIGITUNDER 3 contract
     */
    static createDigitUnder3Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 3,
        }
        return this.createDigitUnderParams(options);
    }

    /**
     * Creates parameters for a DIGITUNDER 3 contract
     */
    static createDigitUnder2Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 2,
        }
        return this.createDigitUnderParams(options);
    }

    /**
     * Creates parameters for a DIGITUNDER 1 contract
     */
    static createDigitUnder1Params(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
    ): ContractParams {
        const options:ContractOptionsParams = {
            amount: amount || this.amount,
            currency: currency || this.currency,
            market: market || this.market,
            duration: duration || this.duration,
            durationUnit: durationUnit || this.duration_unit,
            predictedDigit: 1,
        }
        return this.createDigitUnderParams(options);
    }

    /**
     * Creates parameters for a recovery DIGITUNDER contract
     */
    static createRecoveryDigitUnderParams(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
        predictedDigit: number = 9,
        basis: BasisType = BasisTypeEnum.Default,
    ): ContractParams {
        return {
            amount: amount * 12.37345 || this.amount * 12.37345,
            basis: basis || this.basis,
            contract_type: ContractTypeEnum.DigitUnder || this.contract_type,
            currency: currency || this.currency,
            duration: duration || this.duration,
            duration_unit: durationUnit || this.duration_unit,
            symbol: market || this.market,
            barrier: predictedDigit ? predictedDigit.toString() : getRandomDigit().toString()
        };
    }

    /**
     * Creates parameters for a recovery DIGITOVER contract
     */
    static createRecoveryDigitOverParams(
        amount: number,
        currency: CurrencyType,
        duration: string | number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
        predictedDigit: number = 0,
        basis: BasisType = BasisTypeEnum.Default,
    ): ContractParams {
        return {
            amount: amount * 12.37345 || this.amount * 12.37345,
            basis: basis || this.basis,
            contract_type: ContractTypeEnum.DigitOver || this.contract_type,
            currency: currency || this.currency,
            duration: duration || this.duration,
            duration_unit: durationUnit || this.duration_unit,
            symbol: market || this.market,
            barrier: predictedDigit ? predictedDigit.toString() : getRandomDigit().toString()
        };
    }

}
