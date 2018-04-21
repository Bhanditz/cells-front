<?php
/*
 * Copyright 2007-2017 Abstrium <contact (at) pydio.com>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <https://pydio.com/>.
 */
namespace Pydio\Core\Utils\Vars;

use Pydio\Core\Model\ContextInterface;
use Pydio\Core\Services\ApplicationState;
use Pydio\Core\Services\BinaryService;
use Pydio\Core\Utils\Crypto;

defined('PYDIO_EXEC') or die('Access not allowed');


/**
 * Class FormHelper: manipulate "standard" form submission
 * @package Pydio\Core\Utils
 */
class OptionsHelper
{

    /**
     * 
     * @param $userId
     * @param $password
     * @return string
     */
    public static function decypherStandardFormPassword($userId, $password)
    {
        if(Crypto::hasCBCEnctypeHeader($password)){
            return Crypto::decrypt($password, Crypto::buildKey($userId, Crypto::getApplicationSecret()));
        }else{
            // Legacy encryption
            return Crypto::decrypt($password, md5($userId . "\1CDAFx¨op#"));
        }
    }

    /**
     * @param $metadata
     * @param $nestedData
     * @param null $userId
     * @param null $binariesContext
     * @param string $cypheredPassPrefix
     */
    public static function filterFormElementsFromMeta(ContextInterface $ctx, $metadata, &$nestedData, $userId = null, $binariesContext = null, $cypheredPassPrefix = "")
    {
        foreach ($metadata as $key => $level) {
            if (!array_key_exists($key, $nestedData)) continue;
            if (!is_array($level)) continue;
            if (isSet($level["ajxp_form_element"])) {
                // filter now
                $type = $level["type"];
                if ($type == "binary" && $binariesContext != null) {
                    $value = $nestedData[$key];
                    if ($value == "ajxp-remove-original") {
                        if (!empty($level["original_binary"])) {
                            BinaryService::deleteBinary($binariesContext, $level["original_binary"]);
                        }
                        $value = "";
                    } else {
                        $file = ApplicationState::getTemporaryBinariesFolder() . "/" . $value;
                        if (file_exists($file)) {
                            $id = !empty($level["original_binary"]) ? $level["original_binary"] : null;
                            $id = BinaryService::saveBinary($binariesContext, $file, $id);
                            unlink($file);
                            $value = $id;
                        }
                    }
                    $nestedData[$key] = $value;
                }else if($type === "password" && !empty($cypheredPassPrefix) && $ctx->hasUser()){
                    $value = $nestedData[$key];
                    if(trim($value) !== '' && $value !== '__PYDIO_VALUE_SET__'){
                        $nestedData[$key] = $cypheredPassPrefix . Crypto::encrypt($value, Crypto::buildKey($ctx->getUser()->getId(), Crypto::getApplicationSecret()));
                    }
                }
            } else {
                self::filterFormElementsFromMeta($ctx, $level, $nestedData[$key], $userId, $binariesContext, $cypheredPassPrefix);
            }
        }
    }

    /**
     * @param ContextInterface $ctx
     * @param $repDef
     * @param $options
     * @param string $prefix
     * @param null $binariesContext
     * @param string $cypheredPassPrefix
     */
    public static function parseStandardFormParameters(ContextInterface $ctx, &$repDef, &$options, $prefix = "DRIVER_OPTION_", $binariesContext = null, $cypheredPassPrefix = "")
    {
        if ($binariesContext === null) {
            $binariesContext = array("USER" => ($ctx->hasUser()) ? $ctx->getUser()->getId() : "shared");
        }
        $replicationGroups = array();
        $switchesGroups = array();
        foreach ($repDef as $key => $value) {
            if (((!empty($prefix) && strpos($key, $prefix) !== false && strpos($key, $prefix) == 0) || empty($prefix))
                && strpos($key, "ajxptype") === false
                && strpos($key, "_original_binary") === false
                && strpos($key, "_replication") === false
                && strpos($key, "_checkbox") === false
            ) {
                if (isSet($repDef[$key . "_ajxptype"])) {
                    $type = $repDef[$key . "_ajxptype"];
                    if ($type == "boolean") {
                        $value = ($value == "true" ? true : false);
                    } else if ($type == "integer") {
                        $value = intval($value);
                    } else if ($type == "array") {
                        $value = explode(",", $value);
                    } else if ($type == "password" && $ctx->hasUser() && !empty($cypheredPassPrefix)) {
                        if (trim($value) != "" && $value != "__PYDIO_VALUE_SET__") {
                            $value = $cypheredPassPrefix . Crypto::encrypt($value, Crypto::buildKey($ctx->getUser()->getId(), Crypto::getApplicationSecret()));
                        }
                    } else if ($type == "binary" && $binariesContext !== null) {
                        if (!empty($value)) {
                            if ($value == "ajxp-remove-original") {
                                if (!empty($repDef[$key . "_original_binary"])) {
                                    BinaryService::deleteBinary($binariesContext, $repDef[$key . "_original_binary"]);
                                }
                                $value = "";
                            } else {
                                $file = ApplicationState::getTemporaryBinariesFolder() . "/" . $value;
                                if (file_exists($file)) {
                                    $id = !empty($repDef[$key . "_original_binary"]) ? $repDef[$key . "_original_binary"] : null;
                                    $id = BinaryService::saveBinary($binariesContext, $file, $id);
                                    unlink($file);
                                    $value = $id;
                                }
                            }
                        } else if (!empty($repDef[$key . "_original_binary"])) {
                            $value = $repDef[$key . "_original_binary"];
                        }
                    } else if (strpos($type, "group_switch:") === 0) {
                        $tmp = explode(":", $type);
                        $gSwitchName = $tmp[1];
                        $switchesGroups[substr($key, strlen($prefix))] = $gSwitchName;
                    } else if ($type == "text/json") {
                        $value = json_decode($value, true);
                    }
                    if (!in_array($type, array("textarea", "boolean", "text/json", "password"))) {
                        $value = InputFilter::sanitize($value, InputFilter::SANITIZE_HTML);
                    }
                    unset($repDef[$key . "_ajxptype"]);
                }
                if (isSet($repDef[$key . "_checkbox"])) {
                    $checked = $repDef[$key . "_checkbox"] == "checked";
                    unset($repDef[$key . "_checkbox"]);
                    if (!$checked) continue;
                }
                if (isSet($repDef[$key . "_replication"])) {
                    $repKey = $repDef[$key . "_replication"];
                    if (!is_array($replicationGroups[$repKey])) $replicationGroups[$repKey] = array();
                    $replicationGroups[$repKey][] = $key;
                }
                $options[substr($key, strlen($prefix))] = $value;
                unset($repDef[$key]);
            } else {
                $repDef[$key] = $value;
            }
        }
        // DO SOMETHING WITH REPLICATED PARAMETERS?
        if (count($switchesGroups)) {
            $gValues = array();
            foreach ($switchesGroups as $fieldName => $groupName) {
                if (isSet($options[$fieldName])) {
                    $gValues = array();
                    $radic = $groupName . "_" . $options[$fieldName] . "_";
                    foreach ($options as $optN => $optV) {
                        if (strpos($optN, $radic) === 0) {
                            $newName = substr($optN, strlen($radic));
                            $gValues[$newName] = $optV;
                        }
                    }
                }
                $options[$fieldName . "_group_switch"] = $options[$fieldName];
                $options[$fieldName] = $gValues;
            }
        }

    }
}
