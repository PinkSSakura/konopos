import * as activityaccess from './activityAccess';
import * as adminhub from './adminHub';
import * as analyticsaccess from './analyticsAccess';
import * as authroles from './authRoles';
import * as authstorage from './authStorage';
import * as caissehub from './caisseHub';
import * as customeraccess from './customerAccess';
import * as datefilters from './dateFilters';
import * as establishmentcapabilities from './establishmentCapabilities';
import * as expenseaccess from './expenseAccess';
import * as expenselabels from './expenseLabels';
import * as homeroute from './homeRoute';
import * as hubsections from './hubSections';
import * as inactivitytimeout from './inactivityTimeout';
import * as kdsaccess from './kdsaccess';
import * as licenseaccess from './licenseAccess';
import * as licensedisplay from './licenseDisplay';
import * as listsearch from './listSearch';
import * as loginchallenge from './loginChallenge';
import * as menuhub from './menuHub';
import * as minimumloading from './minimumLoading';
import * as ordereditaccess from './orderEditAccess';
import * as orderownership from './orderOwnership';
import * as paymentaccess from './paymentAccess';
import * as pdfexport from './pdfExport';
import * as permissions from './permissions';
import * as printreceipt from './printReceipt';
import * as rolekeys from './roleKeys';
import * as sessionaccess from './sessionAccess';
import * as shiftaccess from './shiftAccess';
import * as shiftgate from './shiftGate';
import * as staffreportaccess from './staffReportAccess';
import * as tablepagination from './tablePagination';
import * as terminalcontext from './terminalContext';
import * as touchkeyboardinput from './touchKeyboardInput';
import * as touchmodeaccess from './touchModeAccess';

export default function utils() {
  return {
    activityaccess,
    adminhub,
    analyticsaccess,
    authroles,
    authstorage,
    caissehub,
    customeraccess,
    datefilters,
    establishmentcapabilities,
    expenseaccess,
    expenselabels,
    homeroute,
    hubsections,
    inactivitytimeout,
    kdsaccess,
    licenseaccess,
    licensedisplay,
    listsearch,
    loginchallenge,
    menuhub,
    minimumloading,
    ordereditaccess,
    orderownership,
    paymentaccess,
    pdfexport,
    permissions,
    printreceipt,
    rolekeys,
    sessionaccess,
    shiftaccess,
    shiftgate,
    staffreportaccess,
    tablepagination,
    terminalcontext,
    touchkeyboardinput,
    touchmodeaccess,
  };
}
