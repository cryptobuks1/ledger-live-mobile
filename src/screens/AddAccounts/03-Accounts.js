// @flow

import React, { PureComponent } from "react";
import { compose } from "redux";
import { connect } from "react-redux";
import { isAccountEmpty } from "@ledgerhq/live-common/lib/account";
import { createStructuredSelector } from "reselect";
import uniq from "lodash/uniq";
import { translate, Trans } from "react-i18next";
import { SafeAreaView, StyleSheet, View, ScrollView } from "react-native";
import type { NavigationScreenProp } from "react-navigation";
import type { CryptoCurrency, Account } from "@ledgerhq/live-common/lib/types";
import { addAccount } from "../../actions/accounts";
import { accountsSelector } from "../../reducers/accounts";
import { getCurrencyBridge } from "../../bridge";
import Button from "../../components/Button";
import Stepper from "../../components/Stepper";
import StepHeader from "../../components/StepHeader";
import SelectableAccountsList from "../../components/SelectableAccountsList";
import LiveLogo from "../../icons/LiveLogoIcon";
import IconPause from "../../icons/Pause";
import Spinning from "../../components/Spinning";
import LText from "../../components/LText";
import AddAccountsError from "./AddAccountsError";

import colors from "../../colors";

type Props = {
  t: *,
  navigation: NavigationScreenProp<{
    params: {
      currency: CryptoCurrency,
      deviceId: string,
    },
  }>,
  addAccount: Account => void,
  existingAccounts: Account[],
};

type Status = "idle" | "scanning" | "error";

type State = {
  status: Status,
  error: ?Error,
  scannedAccounts: Account[],
  selectedIds: string[],
};

const mapStateToProps = createStructuredSelector({
  existingAccounts: accountsSelector,
});

const mapDispatchToProps = {
  addAccount,
};

class AddAccountsAccounts extends PureComponent<Props, State> {
  static navigationOptions = {
    headerTitle: <StepHeader title="Accounts" subtitle="step 3 of 4" />,
  };

  state = {
    // we assume status is scanning at beginning bcause we start sync at mount
    status: "scanning",
    error: null,
    scannedAccounts: [],
    selectedIds: [],
  };

  componentDidMount() {
    this.startSubscription();
  }

  componentWillUnmount() {
    this.stopSubscription(false);
  }

  startSubscription = () => {
    const { navigation } = this.props;
    const currency = navigation.getParam("currency");
    const deviceId = navigation.getParam("deviceId");
    const bridge = getCurrencyBridge(currency);

    this.scanSubscription = bridge
      .scanAccountsOnDevice(currency, deviceId)
      .subscribe({
        next: account =>
          this.setState(({ scannedAccounts, selectedIds }) => {
            const patch = {
              scannedAccounts: [...scannedAccounts, account],
            };
            if (!isAccountEmpty(account) && !this.isExistingAccount(account)) {
              // $FlowFixMe
              patch.selectedIds = [...selectedIds, account.id];
            }
            return patch;
          }),
        complete: () => this.setState({ status: "idle" }),
        error: error => this.setState({ status: "error", error }),
      });
  };

  restartSubscription = () => {
    this.setState({
      status: "scanning",
      scannedAccounts: [],
      selectedIds: [],
      error: null,
    });
    this.startSubscription();
  };

  stopSubscription = (syncUI = true) => {
    if (this.scanSubscription) {
      this.scanSubscription.unsubscribe();
      this.scanSubscription = null;
      if (syncUI) {
        this.setState({ status: "idle" });
      }
    }
  };

  quitFlow = () => {
    this.props.navigation.navigate("Accounts");
  };

  scanSubscription: *;

  onPressAccount = (account: Account) => {
    const { selectedIds } = this.state;
    const isChecked = selectedIds.indexOf(account.id) > -1;
    const newSelectedIds = isChecked
      ? selectedIds.filter(id => id !== account.id)
      : [...selectedIds, account.id];
    this.setState({ selectedIds: newSelectedIds });
  };

  selectAll = accounts =>
    this.setState(({ selectedIds }) => ({
      selectedIds: uniq([...selectedIds, ...accounts.map(a => a.id)]),
    }));

  unselectAll = accounts =>
    this.setState(({ selectedIds }) => ({
      selectedIds: selectedIds.filter(id => !accounts.find(a => a.id === id)),
    }));

  import = () => {
    const { addAccount, navigation } = this.props;
    const { scannedAccounts, selectedIds } = this.state;
    const currency = navigation.getParam("currency");
    scannedAccounts.forEach(account => {
      if (selectedIds.indexOf(account.id) === -1) return;
      addAccount(account);
    });
    navigation.navigate("AddAccountsSuccess", { currency });
  };

  isExistingAccount = account =>
    this.props.existingAccounts.find(a => a.id === account.id) !== undefined;

  getExistingAccounts = () => {
    const { scannedAccounts } = this.state;
    const { existingAccounts } = this.props;
    return scannedAccounts
      .filter(this.isExistingAccount)
      .map(a => existingAccounts.find(acc => acc.id === a.id) || a);
  };

  getNewAccounts = () =>
    this.state.scannedAccounts.filter(
      a => isAccountEmpty(a) && !this.isExistingAccount(a),
    );

  getRegularAccounts = () =>
    this.state.scannedAccounts.filter(
      a => !isAccountEmpty(a) && !this.isExistingAccount(a),
    );

  EmptyStateNewAccounts = () => {
    const { navigation } = this.props;
    const currency = navigation.getParam("currency");
    return (
      <LText>
        <Trans i18nKey="addAccounts.noAccountToCreate">
          {"PLACEHOLDER-1"}
          <LText semiBold>{currency.name}</LText>
          {"PLACEHOLDER-2"}
        </Trans>
      </LText>
    );
  };

  EmptyStateNewAccountsCantCreate = () => {
    const { scannedAccounts } = this.state;
    const { existingAccounts } = this.props;
    const emptyAccount = scannedAccounts.find(isAccountEmpty);
    if (!emptyAccount) {
      // this should never happen
      return null;
    }
    const correspondingAccount = existingAccounts.find(
      a => a.id === emptyAccount.id,
    );
    if (!correspondingAccount) {
      // this should never happen
      return null;
    }
    return (
      <LText>
        <Trans i18nKey="addAccounts.cantCreateAccount">
          {"PLACEHOLDER-1"}
          <LText semiBold>{correspondingAccount.name}</LText>
          {"PLACEHOLDER-2"}
        </Trans>
      </LText>
    );
  };

  render() {
    const { selectedIds, status, scannedAccounts, error } = this.state;
    const { t } = this.props;
    const newAccounts = this.getNewAccounts();
    const regularAccounts = this.getRegularAccounts();
    const existingAccountsFiltered = this.getExistingAccounts();
    const cantCreateAccount =
      !!scannedAccounts.find(a => isAccountEmpty(a)) &&
      newAccounts.length === 0;
    const noImportableAccounts =
      regularAccounts.length === 0 && newAccounts.length === 0;
    return (
      <SafeAreaView style={styles.root}>
        <Stepper nbSteps={4} currentStep={3} />
        <ScrollView style={styles.inner}>
          {regularAccounts.length > 0 ? (
            <SelectableAccountsList
              header={t("addAccounts.sections.accountsToImport")}
              accounts={regularAccounts}
              onPressAccount={this.onPressAccount}
              onSelectAll={this.selectAll}
              onUnselectAll={this.unselectAll}
              selectedIds={selectedIds}
            />
          ) : status === "scanning" ? (
            <LText style={styles.descText}>
              {t("addAccounts.synchronizingDesc")}
            </LText>
          ) : null}
          {status === "scanning" && <ScanLoading t={t} />}
          {status === "error" &&
            error && (
              <AddAccountsError
                t={t}
                error={error}
                style={styles.addAccountsError}
                onRetry={this.restartSubscription}
              />
            )}
          {(newAccounts.length > 0 || status === "idle") && (
            <SelectableAccountsList
              header={t("addAccounts.sections.addNewAccount")}
              accounts={newAccounts}
              onPressAccount={this.onPressAccount}
              selectedIds={selectedIds}
              EmptyState={
                cantCreateAccount
                  ? this.EmptyStateNewAccountsCantCreate
                  : this.EmptyStateNewAccounts
              }
            />
          )}
          {existingAccountsFiltered.length > 0 && (
            <SelectableAccountsList
              header={t("addAccounts.sections.existing")}
              accounts={existingAccountsFiltered}
              forceSelected
              isDisabled
            />
          )}
        </ScrollView>
        <Footer
          t={t}
          isScanning={status === "scanning"}
          canRetry={
            status !== "scanning" && noImportableAccounts && !cantCreateAccount
          }
          canDone={status !== "scanning" && cantCreateAccount}
          onRetry={this.restartSubscription}
          onStop={this.stopSubscription}
          onDone={this.quitFlow}
          onContinue={this.import}
          isDisabled={selectedIds.length === 0}
        />
      </SafeAreaView>
    );
  }
}

class Footer extends PureComponent<{
  t: *,
  isScanning: boolean,
  canRetry: boolean,
  canDone: boolean,
  onStop: () => void,
  onContinue: () => void,
  onRetry: () => void,
  onDone: () => void,
  isDisabled: boolean,
}> {
  render() {
    const {
      isDisabled,
      onContinue,
      isScanning,
      onStop,
      canRetry,
      canDone,
      onRetry,
      onDone,
      t,
    } = this.props;
    return (
      <View style={styles.footer}>
        {isScanning ? (
          <Button
            type="tertiary"
            title={t("addAccounts.stopScanning")}
            onPress={onStop}
            IconLeft={IconPause}
          />
        ) : canRetry ? (
          <Button
            type="primary"
            title={t("addAccounts.retryScanning")}
            onPress={onRetry}
          />
        ) : canDone ? (
          <Button
            type="primary"
            title={t("addAccounts.done")}
            onPress={onDone}
          />
        ) : (
          <Button
            type="primary"
            title={t("addAccounts.finalCta")}
            onPress={isDisabled ? undefined : onContinue}
          />
        )}
      </View>
    );
  }
}

class ScanLoading extends PureComponent<{ t: * }> {
  render() {
    const { t } = this.props;
    return (
      <View style={styles.scanLoadingRoot}>
        <Spinning>
          <LiveLogo color={colors.grey} size={16} />
        </Spinning>
        <LText semiBold style={styles.scanLoadingText}>
          {t("addAccounts.synchronizing")}
        </LText>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  inner: {
    flex: 1,
    paddingTop: 16,
  },
  descText: {
    paddingHorizontal: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  scanLoadingRoot: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderWidth: 1,
    borderColor: colors.fog,
    borderStyle: "dashed",
    borderRadius: 4,
  },
  scanLoadingText: {
    fontSize: 14,
    color: colors.grey,
    marginLeft: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: colors.lightFog,
    padding: 16,
  },
  addAccountsError: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
});

export default compose(
  translate(),
  connect(
    mapStateToProps,
    mapDispatchToProps,
  ),
)(AddAccountsAccounts);