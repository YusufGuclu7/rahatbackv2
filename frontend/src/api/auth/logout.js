/** @format */

import axiosInstance from "../axiosInstance";
import { cookies } from "../../utils/cookie/index";

export const logout = () => {
  // const refreshToken = cookies.get("jwt-refresh");

  // if (refreshToken) {
  //     axiosInstance.post(`/auth/logout`, {
  //         refreshToken,
  //     });
  // }

  cookies.remove("jwt-access");
  cookies.remove("jwt-access-expires");
  cookies.remove("jwt-refresh");
  cookies.remove("jwt-refresh-expires");
};
