// @flow

import React, { useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { translate, Trans } from "react-i18next";
import type { TFunction } from "react-i18next";
import { BigNumber } from "bignumber.js";
import { formatCurrencyUnit } from "@ledgerhq/live-common/lib/currencies";
import {
  getDefaultExplorerView,
  getAddressExplorer,
} from "@ledgerhq/live-common/lib/explorers";
import {
  formatVotes,
  useTronSuperRepresentatives,
} from "@ledgerhq/live-common/lib/families/tron/react";
import type { Vote } from "@ledgerhq/live-common/lib/families/tron/types";
import type {
  Account,
  Operation,
  Currency,
  Unit,
} from "@ledgerhq/live-common/lib/types";
import LText from "../../components/LText";
import CurrencyUnitValue from "../../components/CurrencyUnitValue";
import CounterValue from "../../components/CounterValue";
import Section from "../../screens/OperationDetails/Section";
import colors from "../../colors";

const helpURL = "https://support.ledger.com/hc/en-us/articles/360013062139";

function getURLWhatIsThis(op: Operation): ?string {
  if (op.type !== "IN" && op.type !== "OUT") {
    return helpURL;
  }
  return undefined;
}

type OperationDetailsExtraProps = {
  extra: { [key: string]: any },
  type: string,
  account: Account,
  t: TFunction,
};

function OperationDetailsExtra({
  extra,
  type,
  account,
  t,
}: OperationDetailsExtraProps) {
  switch (type) {
    case "VOTE": {
      const { votes } = extra;
      if (!votes || !votes.length) return null;

      return <OperationDetailsVotes votes={votes} account={account} t={t} />;
    }
    case "FREEZE": {
      const value = formatCurrencyUnit(
        account.unit,
        BigNumber(extra.frozenAmount),
        { showCode: true },
      );
      return (
        <Section
          title={t("operationDetails.extra.frozenAmount")}
          value={value}
        />
      );
    }
    case "UNFREEZE": {
      const value = formatCurrencyUnit(
        account.unit,
        BigNumber(extra.unfreezeAmount),
        { showCode: true },
      );
      return (
        <Section
          title={t("operationDetails.extra.unfreezeAmount")}
          value={value}
        />
      );
    }
    default:
      return null;
  }
}

type OperationsDetailsVotesProps = {
  votes: Array<Vote>,
  account: Account,
  t: TFunction,
};

function OperationDetailsVotes({
  votes,
  account,
  t,
}: OperationsDetailsVotesProps) {
  const sp = useTronSuperRepresentatives();
  const formattedVotes = formatVotes(votes, sp);

  const redirectAddressCreator = useCallback(
    address => () => {
      const url = getAddressExplorer(
        getDefaultExplorerView(account.currency),
        address,
      );
      if (url) Linking.openURL(url);
    },
    [account],
  );

  return (
    <Section
      title={t("operationDetails.extra.votes", { number: votes.length })}
    >
      {formattedVotes &&
        formattedVotes.map(({ address, voteCount, validator }, i) => (
          <View key={address + i} style={styles.voteWrapper}>
            <View style={styles.voteCountWrapper}>
              <LText style={styles.greyText}>
                <Trans
                  i18nKey="operationDetails.extra.votesAddress"
                  values={{
                    votes: voteCount,
                    name: validator && validator.name,
                  }}
                >
                  <LText semiBold style={styles.text}>
                    text
                  </LText>
                </Trans>
              </LText>
            </View>

            <TouchableOpacity onPress={redirectAddressCreator(address)}>
              <LText style={styles.greyText}>{address}</LText>
            </TouchableOpacity>
          </View>
        ))}
    </Section>
  );
}

type Props = {
  operation: Operation,
  currency: Currency,
  unit: Unit,
};

const AmountCell = ({
  amount,
  unit,
  currency,
  operation,
}: Props & { amount: BigNumber }) =>
  !amount.isZero() ? (
    <>
      <LText tertiary numberOfLines={1} style={styles.topText}>
        <CurrencyUnitValue
          showCode
          unit={unit}
          value={amount}
          alwaysShowSign={false}
        />
      </LText>

      <LText numberOfLines={1} style={styles.amountText}>
        <CounterValue
          showCode
          date={operation.date}
          currency={currency}
          value={amount}
          alwaysShowSign={false}
          withPlaceholder
        />
      </LText>
    </>
  ) : null;

const FreezeAmountCell = ({ operation, currency, unit }: Props) => {
  const amount = new BigNumber(
    operation.extra ? operation.extra.frozenAmount : 0,
  );

  return (
    <AmountCell
      amount={amount}
      operation={operation}
      currency={currency}
      unit={unit}
    />
  );
};

const UnfreezeAmountCell = ({ operation, currency, unit }: Props) => {
  const amount = new BigNumber(
    operation.extra ? operation.extra.unfreezeAmount : 0,
  );

  return (
    <AmountCell
      amount={amount}
      operation={operation}
      currency={currency}
      unit={unit}
    />
  );
};

const VoteAmountCell = ({ operation }: Props) => {
  const amount =
    operation.extra && operation.extra.votes
      ? operation.extra.votes.reduce((sum, { voteCount }) => sum + voteCount, 0)
      : 0;

  return amount > 0 ? (
    <LText numberOfLines={1} tertiary style={[styles.topText, styles.voteText]}>
      <Trans
        i18nKey={"operationDetails.extra.votes"}
        values={{ number: amount }}
      />
    </LText>
  ) : null;
};

const styles = StyleSheet.create({
  voteWrapper: {
    borderLeftWidth: 3,
    borderLeftColor: colors.fog,
    paddingLeft: 16,
    marginBottom: 24,
  },
  text: {
    color: colors.darkBlue,
  },
  greyText: { color: colors.grey },
  voteCountWrapper: {
    marginBottom: 6,
  },
  amountText: {
    color: colors.grey,
    fontSize: 14,
    flex: 1,
  },
  topText: {
    color: colors.darkBlue,
    fontSize: 14,
    flex: 1,
  },
  voteText: { lineHeight: 40 },
});

const amountCell = {
  FREEZE: FreezeAmountCell,
  UNFREEZE: UnfreezeAmountCell,
  VOTE: VoteAmountCell,
};

export default {
  getURLWhatIsThis,
  OperationDetailsExtra: translate()(OperationDetailsExtra),
  amountCell,
};
