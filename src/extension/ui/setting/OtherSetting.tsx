import { memo } from "react";
import LanguageSetting from "./other/Language";
import SponsorBlock from "./other/SponsorBlock";
import ThreadRipper from "./other/ThreadRipper";

const OtherSetting = () => {
  return (
    <>
      <LanguageSetting />
      <br />
      <ThreadRipper />
      <br />
      <SponsorBlock />
    </>
  )
}
export default memo(OtherSetting);