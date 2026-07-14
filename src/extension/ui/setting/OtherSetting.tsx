import { memo } from "react";
import LanguageSetting from "./other/Language";
import SponsorBlock from "./other/SponsorBlock";
import DnsSetting from "./other/DnsSetting";

const OtherSetting = () => {
  return (
    <>
      <LanguageSetting />
      <br />
      <SponsorBlock />
      <br />
      <DnsSetting />
    </>
  )
}
export default memo(OtherSetting);